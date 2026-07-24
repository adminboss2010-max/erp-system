import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { company_id, customer_id, agent_id, amount, payment_method, payment_date, reference, notes } = body;

    if (!company_id || !customer_id || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "بيانات ناقصة (company_id, customer_id, amount > 0 مطلوبين)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies").select("plan, trial_ends_at").eq("id", company_id).single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: "الشركة غير موجودة" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const canWrite = company.plan !== "trial" || company.trial_ends_at === null || new Date(company.trial_ends_at) > new Date();
    if (!canWrite) {
      return new Response(JSON.stringify({ error: "انتهت فترة التجربة المجانية" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: result, error: rpcError } = await supabaseAdmin.rpc("post_payment_transaction", {
      p_company_id: company_id,
      p_customer_id: customer_id,
      p_agent_id: agent_id ?? null,
      p_amount: amount,
      p_payment_method: payment_method ?? "cash",
      p_payment_date: payment_date ?? new Date().toISOString(),
      p_reference: reference ?? null,
      p_notes: notes ?? null,
    });

    if (rpcError) {
      return new Response(JSON.stringify({ error: "فشل تنفيذ المعاملة", details: rpcError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, transaction: result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "خطأ غير متوقع في السيرفر" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});