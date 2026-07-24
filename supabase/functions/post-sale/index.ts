// supabase/functions/post-sale/index.ts
//
// وظيفة هذه الدالة: تسجيل فاتورة بيع كاملة (قد تحتوي على أكثر من صنف) بشكل ذري (atomic) —
// إما تنجح كل أصناف الفاتورة مع بعض، أو تفشل كلها مع بعض (لا يوجد نصف تنفيذ).
// كل أصناف الفاتورة تُعالج داخل نفس المعاملة الذرية الواحدة في PostgreSQL (post_sale_transaction)،
// وليس عبر استدعاءات منفصلة متكررة من هنا.
//
// الخطوات المنفذة لكل صنف من أصناف الفاتورة (داخل معاملة واحدة في قاعدة البيانات):
// 1. التحقق من وجود مخزون كافٍ للصنف
// 2. رفض الفاتورة بالكامل لو أي صنف مخزونه غير كافٍ (سياسة صارمة، مناسبة لشركات المواد الغذائية)
// 3. تقليل المخزون (stock_qty)
// 4. لو البيع بالآجل (is_credit = true) → زيادة رصيد العميل (balance) بإجمالي الفاتورة
// 5. تسجيل صف معاملة لكل صنف في جدول transactions (كلها بنفس doc_no)
// 6. تسجيل عملية تدقيق واحدة للفاتورة كاملة في audit_log

import { createClient } from "jsr:@supabase/supabase-js@2";

// 🛡️ لازمة لأي استدعاء من متصفح حقيقي (frontend) — curl/Invoke-RestMethod بيتجاوزوا CORS
// تلقائيًا فمكانتش هذه المشكلة ظهرت في اختبارات المرحلة 3 (كانت كلها عبر أدوات command-line)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // طلب Preflight من المتصفح قبل أي POST فعلي عبر fetch()
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // فقط POST مسموح
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json();
    const {
      company_id,
      customer_id,
      agent_id,
      items, // [{ item_id, qty, unit_cost?, unit_price? }, ...] — صنف واحد أو أكثر لنفس الفاتورة
      is_credit, // true = بيع بالآجل (يزيد رصيد العميل) / false = بيع نقدي
      doc_no,
    } = body;

    // تحقق أساسي من صحة المدخلات قبل أي عملية على القاعدة
    if (!company_id || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "بيانات ناقصة أو غير صحيحة (company_id, items[] مطلوبة)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    for (const it of items) {
      if (!it || !it.item_id || !it.qty || Number(it.qty) <= 0) {
        return new Response(
          JSON.stringify({ error: "كل صنف في الفاتورة لازم يحتوي على item_id وqty أكبر من صفر" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // عميل Supabase بصلاحية service_role — يتخطى RLS، لأن الدالة نفسها
    // هي المسؤولة عن فرض المنطق الصحيح، مش الاعتماد على RLS هنا
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // التحقق أولاً: هل الشركة نفسها مسموح لها بالكتابة؟ (نفس منطق company_can_write)
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("plan, trial_ends_at")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: "الشركة غير موجودة" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const canWrite =
      company.plan !== "trial" ||
      company.trial_ends_at === null ||
      new Date(company.trial_ends_at) > new Date();

    if (!canWrite) {
      return new Response(
        JSON.stringify({ error: "انتهت فترة التجربة المجانية. يرجى الاشتراك لمتابعة العمليات." }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // تنفيذ الفاتورة كاملة (كل الأصناف) عبر دالة قاعدة بيانات واحدة (RPC) لضمان الذرية (atomicity) —
    // فحص المخزون والخصم نفسه بيحصل جوه الدالة لكل صنف، مش هنا، عشان يفضل ذري وبدون Race Condition
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "post_sale_transaction",
      {
        p_company_id: company_id,
        p_customer_id: customer_id ?? null,
        p_agent_id: agent_id ?? null,
        p_items: items,
        p_is_credit: is_credit ?? false,
        p_doc_no: doc_no ?? null,
      }
    );

    if (rpcError) {
      console.error("post_sale_transaction error:", rpcError);
      // رسائل الرفض المتعمدة من الدالة (مخزون غير كافٍ، صنف غير موجود، إلخ) بتوصل هنا كـ message واضح
      return new Response(
        JSON.stringify({ error: "فشل تنفيذ الفاتورة", details: rpcError.message }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ success: true, transaction: result }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "خطأ غير متوقع في السيرفر" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
