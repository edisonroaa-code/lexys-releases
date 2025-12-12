import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qtigmnjctvpyafxqxlow.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0aWdtbmpjdHZweWFmeHF4bG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyODcxOTEsImV4cCI6MjA2Njg2MzE5MX0.v7mVihA_TQCdkzbIdMrWplLod4wc5hHfscxfDq2c3Ys';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
