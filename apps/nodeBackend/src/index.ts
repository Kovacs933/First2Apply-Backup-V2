// migration.ts
import dotenv from 'dotenv';

import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!, // Use service key for admin access
);

async function migrateJobTags() {
  console.log('Starting migration...');
  const batchSize = 1000;
  let totalUpdated = 0;

  while (true) {
    try {
      const { data, error } = await supabase.rpc('update_jobs_batch', {
        batch_size: batchSize,
      });

      if (error) throw error;
      if (data === 0) break; // No more rows to update

      totalUpdated += data;
      console.log(`Updated ${data} rows (total: ${totalUpdated})`);

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error('Batch failed:', err);
      break;
    }
  }

  // Apply constraints after all updates
  console.log('Applying NOT NULL constraint...');
  const { error } = await supabase.rpc('apply_tags_constraint');
  if (error) throw error;

  console.log(`Migration complete! Updated ${totalUpdated} total rows`);
}

migrateJobTags().catch(console.error);
