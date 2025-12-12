import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Manejo de la solicitud pre-vuelo CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email: newUserEmail } = await req.json()

    // Crear un cliente de Supabase para esta solicitud, usando el token de autenticación del usuario que llama a la función.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Obtener el perfil del usuario que está haciendo la invitación.
    const { data: invitingUser, error: userError } = await supabaseClient.auth.getUser()
    if (userError) throw userError

    const { data: invitingUserProfile, error: profileError } = await supabaseClient
      .from('perfiles')
      .select('despacho_id, rol')
      .eq('id', invitingUser.user.id)
      .single()

    if (profileError) throw new Error('No se pudo encontrar el perfil del usuario que invita.')

    // Comprobar si el usuario que invita es un administrador.
    if (invitingUserProfile.rol !== 'admin') {
      throw new Error('No tienes permiso para invitar a nuevos miembros.')
    }

    // Crear un cliente de Supabase con permisos de administrador para enviar la invitación.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Enviar la invitación por correo electrónico.
    const { data, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        newUserEmail,
        { 
          data: {
            despacho_id: invitingUserProfile.despacho_id,
            rol: 'abogado' // Los nuevos usuarios son abogados por defecto
          }
        }
    )

    if (inviteError) throw inviteError

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
