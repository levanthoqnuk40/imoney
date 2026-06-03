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

        // ============================================
        // 4. Tự động ghi nhận Hoàn trả chi hộ qua VietQR
        // ============================================
        try {
            const descriptionText = content || description || ''
            const match = descriptionText.match(/IMN\s*CH\s*([a-f0-9]{5})([a-f0-9]{5})/i)
            if (match) {
                const eventShort = match[1].toLowerCase()
                const participantShort = match[2].toLowerCase()
                console.log(`Found VietQR code matching event: ${eventShort}, participant: ${participantShort}`)

                // Tìm sự kiện chi hộ có UUID kết thúc bằng eventShort
                const { data: events, error: eventErr } = await supabase
                    .from('expense_events')
                    .select('id, user_id, status')
                    .filter('id::text', 'like', `%${eventShort}`)

                if (!eventErr && events && events.length > 0) {
                    const event = events[0]
                    
                    // Tìm thành viên tham gia có UUID kết thúc bằng participantShort
                    const { data: participants, error: partErr } = await supabase
                        .from('expense_participants')
                        .select('id, display_name')
                        .eq('event_id', event.id)
                        .filter('id::text', 'like', `%${participantShort}`)

                    if (!partErr && participants && participants.length > 0) {
                        const participant = participants[0]
                        const amount = parseFloat(String(transferAmount))

                        // Thêm bản ghi hoàn trả
                        const { error: repayErr } = await supabase
                            .from('repayments')
                            .insert({
                                event_id: event.id,
                                participant_id: participant.id,
                                repayment_date: parsedDate ? parsedDate.split('T')[0] : new Date().toISOString().split('T')[0],
                                amount: amount,
                                payment_method: 'transfer',
                                reference_no: referenceCode || id,
                                note: `Tự động ghi nhận qua VietQR (Sepay: ${id})`
                            })

                        if (repayErr) {
                            console.error('Failed to insert auto-repayment:', repayErr)
                        } else {
                            console.log(`Auto-repayment logged for participant ${participant.display_name} in event ${event.id} of amount ${amount}`)
                            
                            // Cập nhật trạng thái sự kiện dựa trên tổng dư nợ còn lại
                            const { data: splits } = await supabase
                                .from('expense_splits')
                                .select('amount_due')
                                .eq('event_id', event.id)

                            const { data: repayments } = await supabase
                                .from('repayments')
                                .select('amount')
                                .eq('event_id', event.id)

                            if (splits && repayments) {
                                // Tính tổng phải thu từ bạn bè (không tính chủ chi hộ)
                                const { data: friends } = await supabase
                                    .from('expense_participants')
                                    .select('id')
                                    .eq('event_id', event.id)
                                    .eq('is_owner', false)

                                const friendIds = (friends || []).map(f => f.id)
                                
                                const totalDue = splits
                                    .filter(s => friendIds.includes(s.participant_id))
                                    .reduce((sum, s) => sum + parseFloat(s.amount_due), 0)

                                const totalPaid = repayments
                                    .filter(r => friendIds.includes(r.participant_id))
                                    .reduce((sum, r) => sum + parseFloat(r.amount), 0)
                                
                                let newStatus: 'open' | 'partial' | 'settled' = 'open'
                                if (totalPaid >= totalDue && totalDue > 0) {
                                    newStatus = 'settled'
                                } else if (totalPaid > 0) {
                                    newStatus = 'partial'
                                }

                                if (event.status !== newStatus) {
                                    await supabase
                                        .from('expense_events')
                                        .update({ status: newStatus, updated_at: new Date().toISOString() })
                                        .eq('id', event.id)
                                    console.log(`Updated event ${event.id} status to ${newStatus}`)
                                }
                            }
                        }
                    } else {
                        console.warn(`Participant not found matching short code: ${participantShort}`)
                    }
                } else {
                    console.warn(`Event not found matching short code: ${eventShort}`)
                }
            }
        } catch (repayCatch) {
            console.error('Error during auto-repayment processing:', repayCatch)
        }

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
