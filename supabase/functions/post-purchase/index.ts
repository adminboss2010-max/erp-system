// supabase/functions/post-purchase/index.ts
//
// تسجيل فاتورة شراء كاملة بشكل ذري — عكس منطق post-sale:
// يزيد المخزون (مش يقلله)، ويزيد رصيد المورد (لو آجل)، بدون فحص كفاية مخزون
// (الشراء مسموح دايمًا)، مع دعم الضريبة لكل صنف.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // الرد على طلب OPTIONS التمهيدي (Preflight) اللي المتصفح بيبعته تلقائيًا
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { company_id, supplier_id, items, is_credit, doc_no } = body;

    if (!company_id || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "بيانات ناقصة أو غير صحيحة (company_id, items[] مطلوبة)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
      "post_purchase_transaction",
      {
        p_company_id: company_id,
        p_supplier_id: supplier_id ?? null,
        p_items: items,
        p_is_credit: is_credit ?? false,
        p_doc_no: doc_no ?? null,
      }
    );

    if (rpcError) {
      console.error("post_purchase_transaction error:", rpcError);
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