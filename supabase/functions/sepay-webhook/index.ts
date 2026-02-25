// Supabase Edge Function: Sepay Webhook Receiver
// Deploy: supabase functions deploy sepay-webhook --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://levanthoqnuk40.github.io',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sepay-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Only accept POST
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ success: false, message: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    try {
        // ============================================
        // 1. Xác thực API Key
        // ============================================
        const apiKey = req.headers.get('Authorization') ||
            req.headers.get('x-sepay-key') ||
            new URL(req.url).searchParams.get('key')

        const expectedKey = Deno.env.get('SEPAY_WEBHOOK_SECRET')

        if (!expectedKey) {
            console.error('SEPAY_WEBHOOK_SECRET is not configured')
            return new Response(
                JSON.stringify({ success: false, message: 'Server configuration error' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (apiKey !== expectedKey) {
            console.warn('Invalid API key received')
            return new Response(
                JSON.stringify({ success: false, message: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ============================================
        // 2. Parse Sepay webhook payload
        // ============================================
        const body = await req.json()
        console.log('Sepay webhook received, id:', body.id)

        // Validate required fields
        const {
            id,
            gateway,
            transactionDate,
            accountNumber,
            transferType,
            transferAmount,
            accumulated,
            content,        // Sepay gọi description là "content"
            referenceCode,
            description,    // Một số version gọi là description
        } = body

        if (!id || !transferAmount) {
            return new Response(
                JSON.stringify({ success: false, message: 'Missing required fields: id, transferAmount' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // ============================================
        // 3. Insert vào Supabase (dùng service_role key)
        // ============================================
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Parse transaction date
        let parsedDate: string | null = null
        if (transactionDate) {
            try {
                parsedDate = new Date(transactionDate).toISOString()
            } catch {
                parsedDate = new Date().toISOString()
            }
        }

        // Xác định transfer_type
        const resolvedTransferType = transferType ||
            (body.creditAmount && parseFloat(body.creditAmount) > 0 ? 'in' : 'out')

        // Insert – unique constraint on sepay_id sẽ chặn duplicate
        const { data, error } = await supabase
            .from('sepay_transactions')
            .insert({
                sepay_id: id,
                gateway: gateway || null,
                transaction_date: parsedDate,
                account_number: accountNumber || null,
                transfer_type: resolvedTransferType,
                transfer_amount: parseFloat(String(transferAmount)),
                accumulated: accumulated ? parseFloat(String(accumulated)) : null,
                description: content || description || null,
                reference_code: referenceCode || null,
                raw_payload: body,
            })
            .select()
            .single()

        if (error) {
            // Duplicate – Sepay gửi lại
            if (error.code === '23505') {
                console.log('Duplicate transaction ignored:', id)
                return new Response(
                    JSON.stringify({ success: true, message: 'Transaction already processed' }),
                    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            console.error('Supabase insert error:', error)
            return new Response(
                JSON.stringify({ success: false, message: error.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('Transaction saved successfully:', data.id)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Transaction received and processed',
                transaction_id: data.id
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Webhook processing error:', error)
        return new Response(
            JSON.stringify({ success: false, message: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
