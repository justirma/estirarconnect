import { supabase } from '../config/supabase.js';
import dotenv from 'dotenv';

dotenv.config();

const chairExerciseVideos = [
  // English Videos
  {
    title: "10-Minute Seated Morning Stretch",
    youtube_url: "https://www.youtube.com/watch?v=7L8vAGt9m8Q",
    category: "Morning Stretch",
    language: "en",
    sequence_order: 1
  },
  {
    title: "Chair Yoga for Seniors - 15 Minutes",
    youtube_url: "https://www.youtube.com/watch?v=KwfJ9b-G0aI",
    category: "Yoga",
    language: "en",
    sequence_order: 2
  },
  {
    title: "Gentle Chair Exercises for Seniors",
    youtube_url: "https://www.youtube.com/watch?v=ZcRNd6ebdvE",
    category: "Gentle Exercise",
    language: "en",
    sequence_order: 3
  },
  {
    title: "Chair Cardio Workout - Low Impact",
    youtube_url: "https://www.youtube.com/watch?v=l-jwTOa18gA",
    category: "Cardio",
    language: "en",
    sequence_order: 4
  },
  {
    title: "Seated Strength Training for Seniors",
    youtube_url: "https://www.youtube.com/watch?v=e0rSmxsVHPw",
    category: "Strength",
    language: "en",
    sequence_order: 5
  },
  {
    title: "Chair Exercises for Balance & Stability",
    youtube_url: "https://www.youtube.com/watch?v=Rj2hUl8i1c4",
    category: "Balance",
    language: "en",
    sequence_order: 6
  },

  // Spanish Videos
  {
    title: "Ejercicios en Silla para Adultos Mayores",
    youtube_url: "https://www.youtube.com/watch?v=3oWg6pZjY8s",
    category: "General",
    language: "es",
    sequence_order: 1
  },
  {
    title: "Yoga en Silla - Estiramientos Suaves",
    youtube_url: "https://www.youtube.com/watch?v=K8nNmKC7-2g",
    category: "Yoga",
    language: "es",
    sequence_order: 2
  },
  {
    title: "Ejercicios Sentados para la Mañana",
    youtube_url: "https://www.youtube.com/watch?v=bH7WCrYLBvQ",
    category: "Morning Stretch",
    language: "es",
    sequence_order: 3
  },
  {
    title: "Cardio Sentado para Mayores",
    youtube_url: "https://www.youtube.com/watch?v=QdPUlEZvOVk",
    category: "Cardio",
    language: "es",
    sequence_order: 4
  },
  {
    title: "Fortalecimiento en Silla",
    youtube_url: "https://www.youtube.com/watch?v=VGaYJ9jvQpw",
    category: "Strength",
    language: "es",
    sequence_order: 5
  },
  {
    title: "Ejercicios de Equilibrio Sentado",
    youtube_url: "https://www.youtube.com/watch?v=h8zJrTjMJjE",
    category: "Balance",
    language: "es",
    sequence_order: 6
  }
];

async function seedVideos() {
  console.log('Starting video seed...');

  try {
    // Check if videos already exist
    const { data: existingVideos } = await supabase
      .from('videos')
      .select('id');

    if (existingVideos && existingVideos.length > 0) {
      console.log(`Found ${existingVideos.length} existing videos. Skipping seed.`);
      console.log('To re-seed, delete existing videos from the database first.');
      return;
    }

    // Insert videos
    const { data, error } = await supabase
      .from('videos')
      .insert(chairExerciseVideos)
      .select();

    if (error) {
      console.error('Error seeding videos:', error);
      throw error;
    }

    console.log(`Successfully seeded ${data.length} videos!`);
    console.log('Videos by language:');
    console.log(`- English: ${data.filter(v => v.language === 'en').length}`);
    console.log(`- Spanish: ${data.filter(v => v.language === 'es').length}`);

  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

async function seedTestSeniors() {
  console.log('\nSeeding test seniors...');

  const testSeniors = [
    {
      phone_number: '+1234567890',
      language: 'en'
    },
    {
      phone_number: '+1234567891',
      language: 'es'
    }
  ];

  try {
    const { data, error } = await supabase
      .from('seniors')
      .insert(testSeniors)
      .select();

    if (error) {
      if (error.code === '23505') {
        console.log('Test seniors already exist. Skipping.');
        return;
      }
      throw error;
    }

    console.log(`Successfully seeded ${data.length} test seniors!`);
  } catch (error) {
    console.error('Error seeding test seniors:', error);
  }
}

async function runSeed() {
  await seedVideos();
  await seedTestSeniors();
  console.log('\n✅ Seed complete!');
  process.exit(0);
}

runSeed();
