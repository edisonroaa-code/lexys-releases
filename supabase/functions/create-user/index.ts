import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Manejo de la solicitud pre-vuelo CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email, password, despacho_id } = await req.json() // <-- OBTENEMOS EL DESPACHO_ID

    // Crear un cliente de Supabase con rol de servicio para operaciones de administrador
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Crear el usuario en Supabase Auth
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Marcar el email como confirmado automáticamente
    })

    if (authError) {
      throw new Error(`Error de autenticación: ${authError.message}`)
    }

    // 2. Crear el perfil del usuario y VINCULARLO AL DESPACHO
    const { error: profileError } = await supabaseAdmin
      .from('perfiles')
      .insert({
        id: user.id,
        nombre_completo: name,
        email: email,
        despacho_id: despacho_id, // <-- USAMOS EL DESPACHO_ID AQUÍ
        rol: 'abogado' // Rol por defecto para nuevos miembros
      })

    if (profileError) {
      // Si falla la creación del perfil, borrar el usuario de Auth para evitar inconsistencias
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      throw new Error(`Error al crear el perfil: ${profileError.message}`)
    }

    return new Response(JSON.stringify({ message: "Usuario creado exitosamente" }), {
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