// supabase/functions/post-payment/index.ts
//
// وظيفة هذه الدالة: تسجيل سداد دفعة من عميل — تقليل رصيده + تسجيل معاملة
// من نوع "payment" + audit_log، بشكل ذري عبر دالة RPC واحدة.
// لا علاقة لها بالمخزون أو أي صنف.

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
    const { company_id, customer_id, agent_id, amount } = body;

    if (!company_id || !customer_id || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({
          error: "بيانات ناقصة أو غير صحيحة (company_id, customer_id, amount مطلوبة)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // التحقق من أن الشركة مسموح لها بالكتابة
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

    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "post_payment_transaction",
      {
        p_company_id: company_id,
        p_customer_id: customer_id,
        p_agent_id: agent_id ?? null,
        p_amount: amount,
      }
    );

    if (rpcError) {
      console.error("post_payment_transaction error:", rpcError);
      return new Response(
        JSON.stringify({ error: "فشل تنفيذ الدفعة", details: rpcError.message }),
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