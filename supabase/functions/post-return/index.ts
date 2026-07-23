// supabase/functions/post-return/index.ts
//
// وظيفة هذه الدالة: تسجيل معاملة مرتجع كاملة بشكل ذري (atomic) —
// عكس منطق البيع: زيادة المخزون + تقليل رصيد العميل (لو الفاتورة الأصلية كانت بالآجل).
// يُشترط وجود رقم فاتورة البيع الأصلية (ref_doc_no) لأي مرتجع، لضمان التتبع المحاسبي.

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
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
      is_credit,   // هل الفاتورة الأصلية كانت بالآجل؟
      ref_doc_no,  // رقم فاتورة البيع الأصلية — مطلوب
    } = body;

    if (!company_id || !item_id || !qty || qty <= 0 || !ref_doc_no) {
      return new Response(
        JSON.stringify({
          error: "بيانات ناقصة أو غير صحيحة (company_id, item_id, qty, ref_doc_no مطلوبة)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // التحقق من أن الشركة مسموح لها بالكتابة (نفس فحص company_can_write)
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

    // استدعاء دالة قاعدة البيانات الذرية
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "post_return_transaction",
      {
        p_company_id: company_id,
        p_customer_id: customer_id ?? null,
        p_agent_id: agent_id ?? null,
        p_item_id: item_id,
        p_qty: qty,
        p_unit_cost: unit_cost ?? null,
        p_unit_price: unit_price ?? null,
        p_is_credit: is_credit ?? false,
        p_ref_doc_no: ref_doc_no,
      }
    );

    if (rpcError) {
      console.error("post_return_transaction error:", rpcError);
      // رسائل الرفض المتعمدة من الدالة (فاتورة أصلية غير موجودة، إلخ) بتوصل هنا كـ message واضح
      return new Response(
        JSON.stringify({ error: "فشل تنفيذ المرتجع", details: rpcError.message }),
        { status: 422, headers: { "Content-Type": "application/json" } }
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