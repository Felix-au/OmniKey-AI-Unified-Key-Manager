import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('CRITICAL: MONGODB_URI is not defined in the environment variables.');
  process.exit(1);
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error('CRITICAL: MONGODB_URI environment variable is not defined.');
  }
  try {
    mongoose.connection.on('connected', () => {
      console.log('Successfully connected to MongoDB Cluster.');
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB connection disconnected.');
    });

    // Clean teardown on exit
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed via application termination.');
      process.exit(0);
    });

    return await mongoose.connect(MONGODB_URI);
  } catch (error) {
    console.error('Failed to establish initial MongoDB connection:', error);
    throw error;
  }
}
