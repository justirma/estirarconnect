import { supabase } from '../config/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

// Sample workouts for April 2026 — "Balance" theme
// Replace image_url values with your actual Supabase Storage URLs after uploading
const sampleWorkouts = [
  // English - April 2026 - Balance Theme
  {
    title: "Balance Basics",
    description: "3 exercises: Seated Heel Raises, Toe Taps, Ankle Circles. 5 min each.",
    image_url: "https://YOUR_SUPABASE_PROJECT.supabase.co/storage/v1/object/public/workout-images/2026-04/en/week1-balance-basics.jpg",
    theme: "Balance",
    language: "en",
    month: 4,
    year: 2026,
    week_number: 1,
    sequence_order: 1,
    active: true
  },
  {
    title: "Steady & Strong",
    description: "3 exercises: Seated Marching, Leg Extensions, Side Leans. 5 min each.",
    image_url: "https://YOUR_SUPABASE_PROJECT.supabase.co/storage/v1/object/public/workout-images/2026-04/en/week2-steady-strong.jpg",
    theme: "Balance",
    language: "en",
    month: 4,
    year: 2026,
    week_number: 2,
    sequence_order: 2,
    active: true
  },
  {
    title: "Core & Stability",
    description: "3 exercises: Seated Twists, Knee Lifts, Arm Reaches. 5 min each.",
    image_url: "https://YOUR_SUPABASE_PROJECT.supabase.co/storage/v1/object/public/workout-images/2026-04/en/week3-core-stability.jpg",
    theme: "Balance",
    language: "en",
    month: 4,
    year: 2026,
    week_number: 3,
    sequence_order: 3,
    active: true
  },
  {
    title: "Balance Challenge",
    description: "3 exercises: Stand & Sit, Heel-Toe Rocks, Side Steps. 5 min each.",
    image_url: "https://YOUR_SUPABASE_PROJECT.supabase.co/storage/v1/object/public/workout-images/2026-04/en/week4-balance-challenge.jpg",
    theme: "Balance",
    language: "en",
    month: 4,
    year: 2026,
    week_number: 4,
    sequence_order: 4,
    active: true
  },

  // Spanish - April 2026 - Balance Theme
  {
    title: "Equilibrio Básico",
    description: "3 ejercicios: Elevaciones de Talón, Toque de Pies, Círculos de Tobillo. 5 min cada uno.",
    image_url: "https://YOUR_SUPABASE_PROJECT.supabase.co/storage/v1/object/public/workout-images/2026-04/es/week1-equilibrio-basico.jpg",
    theme: "Equilibrio",
    language: "es",
    month: 4,
    year: 2026,
    week_number: 1,
    sequence_order: 1,
    active: true
  },
  {
    title: "Firme y Fuerte",
    description: "3 ejercicios: Marcha Sentado, Extensiones de Pierna, Inclinaciones Laterales. 5 min cada uno.",
    image_url: "https://YOUR_SUPABASE_PROJECT.supabase.co/storage/v1/object/public/workout-images/2026-04/es/week2-firme-fuerte.jpg",
    theme: "Equilibrio",
    language: "es",
    month: 4,
    year: 2026,
    week_number: 2,
    sequence_order: 2,
    active: true
  },
  {
    title: "Centro y Estabilidad",
    description: "3 ejercicios: Giros Sentado, Elevaciones de Rodilla, Alcances con Brazos. 5 min cada uno.",
    image_url: "https://YOUR_SUPABASE_PROJECT.supabase.co/storage/v1/object/public/workout-images/2026-04/es/week3-centro-estabilidad.jpg",
    theme: "Equilibrio",
    language: "es",
    month: 4,
    year: 2026,
    week_number: 3,
    sequence_order: 3,
    active: true
  },
  {
    title: "Desafío de Equilibrio",
    description: "3 ejercicios: Sentarse y Pararse, Balanceo Talón-Punta, Pasos Laterales. 5 min cada uno.",
    image_url: "https://YOUR_SUPABASE_PROJECT.supabase.co/storage/v1/object/public/workout-images/2026-04/es/week4-desafio-equilibrio.jpg",
    theme: "Equilibrio",
    language: "es",
    month: 4,
    year: 2026,
    week_number: 4,
    sequence_order: 4,
    active: true
  }
];

async function seedWorkouts() {
  console.log('Starting workout seed...');

  try {
    const { data: existing } = await supabase
      .from('workouts')
      .select('id');

    if (existing && existing.length > 0) {
      console.log(`Found ${existing.length} existing workouts. Skipping seed.`);
      console.log('To re-seed, delete existing workouts from the database first.');
      return;
    }

    const { data, error } = await supabase
      .from('workouts')
      .insert(sampleWorkouts)
      .select();

    if (error) {
      console.error('Error seeding workouts:', error);
      throw error;
    }

    console.log(`Successfully seeded ${data.length} workouts!`);
    console.log('Workouts by language:');
    console.log(`- English: ${data.filter(w => w.language === 'en').length}`);
    console.log(`- Spanish: ${data.filter(w => w.language === 'es').length}`);
    console.log(`\nTheme: ${data[0].theme}`);
    console.log(`Month: ${data[0].month}/${data[0].year}`);
    console.log('\n⚠️  Remember to replace the placeholder image_url values with actual Supabase Storage URLs!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

async function runSeed() {
  await seedWorkouts();
  console.log('\n✅ Workout seed complete!');
  process.exit(0);
}

runSeed();
