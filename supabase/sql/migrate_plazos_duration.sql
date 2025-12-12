-- Normaliza los plazos antiguos que sólo tenían el texto libre "duracion_plazo".
-- Ejecutar una sola vez directamente en la base de datos de Supabase.

WITH parsed AS (
    SELECT
        id,
        (regexp_matches(lower(duracion_plazo), '(\\d+)'))[1]::int AS numero,
        CASE
            WHEN duracion_plazo ILIKE '%hora%' THEN 'horas'
            WHEN duracion_plazo ILIKE '%semana%' THEN 'semanas'
            WHEN duracion_plazo ILIKE '%mes%' THEN 'meses'
            ELSE 'días'
        END AS unidad_guess,
        CASE
            WHEN duracion_plazo ILIKE '%corrid%' THEN 'corridos'
            ELSE 'habiles'
        END AS tipo_guess
    FROM plazos_procesales
    WHERE duracion_plazo IS NOT NULL
)
UPDATE plazos_procesales p
SET
    duracion_numero = COALESCE(p.duracion_numero, parsed.numero),
    unidad = COALESCE(p.unidad, parsed.unidad_guess),
    tipo_duracion = COALESCE(p.tipo_duracion, parsed.tipo_guess)
FROM parsed
WHERE p.id = parsed.id;

-- Opcional: dejar de usar la columna antigua si ya no se necesita.
-- ALTER TABLE plazos_procesales DROP COLUMN duracion_plazo;
