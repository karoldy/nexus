import 'dotenv/config';
import { seedRbac } from '../src/rbac/seed';

async function main() {
  await seedRbac();
  console.log('RBAC seed complete');
}

void main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
