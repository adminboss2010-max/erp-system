// supabase/functions/post-sale/index.ts
//
// وظيفة هذه الدالة: تسجيل معاملة بيع كاملة بشكل ذري (atomic) —
// إما تنجح كل الخطوات مع بعض، أو تفشل كلها مع بعض (لا يوجد نصف تنفيذ).
//
// الخطوات المنفذة داخل معاملة واحدة (transaction) في قاعدة البيانات:
// 1. التحقق من وجود مخزون كافٍ للصنف المطلوب
// 2. رفض العملية بالكامل لو المخزون غير كافٍ (سياسة صارمة، مناسبة لشركات المواد الغذائية)
// 3. تقليل المخزون (stock_qty)
// 4. لو البيع بالآجل (is_credit = true) → زيادة رصيد العميل (balance)
// 5. تسجيل المعاملة في جدول transactions
// 6. تسجيل العملية في audit_log

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // فقط POST مسموح
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      company_id,
      customer_id,
      agent_id,
      item_id,
      qty,
      unit_cost,
      unit_price,
      is_credit, // true = بيع بالآجل (يزيد رصيد العميل) / false = بيع نقدي
      doc_no,
    } = body;

    // تحقق أساسي من صحة المدخلات قبل أي عملية على القاعدة
    if (!company_id || !item_id || !qty || qty <= 0) {
      return new Response(
        JSON.stringify({ error: "بيانات ناقصة أو غير صحيحة (company_id, item_id, qty مطلوبة)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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
        headers: { "Content-Type": "application/json" },
      });
    }

    const canWrite =
      company.plan !== "trial" ||
      company.trial_ends_at === null ||
      new Date(company.trial_ends_at) > new Date();

    if (!canWrite) {
      return new Response(
        JSON.stringify({ error: "انتهت فترة التجربة المجانية. يرجى الاشتراك لمتابعة العمليات." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // جلب الصنف والتحقق من المخزون
    const { data: item, error: itemError } = await supabaseAdmin
      .from("items")
      .select("stock_qty, name")
      .eq("id", item_id)
      .eq("company_id", company_id)
      .single();

    if (itemError || !item) {
      return new Response(JSON.stringify({ error: "الصنف غير موجود" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // سياسة صارمة: رفض العملية بالكامل لو المخزون غير كافٍ
    if (item.stock_qty < qty) {
      return new Response(
        JSON.stringify({
          error: `المخزون غير كافٍ للصنف "${item.name}". المتوفر: ${item.stock_qty}, المطلوب: ${qty}`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // تنفيذ العملية عبر دالة قاعدة بيانات واحدة (RPC) لضمان الذرية (atomicity)
    // ملاحظة: يجب إنشاء دالة post_sale_transaction في قاعدة البيانات أولاً (خطوة منفصلة تالية)
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "post_sale_transaction",
      {
        p_company_id: company_id,
        p_customer_id: customer_id ?? null,
        p_agent_id: agent_id ?? null,
        p_item_id: item_id,
        p_qty: qty,
        p_unit_cost: unit_cost ?? null,
        p_unit_price: unit_price ?? null,
        p_is_credit: is_credit ?? false,
        p_doc_no: doc_no ?? null,
      }
    );

    if (rpcError) {
      console.error("post_sale_transaction error:", rpcError);
      return new Response(
        JSON.stringify({ error: "فشل تنفيذ المعاملة", details: rpcError.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, transaction: result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "خطأ غير متوقع في السيرفر" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});