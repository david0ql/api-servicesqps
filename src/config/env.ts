import * as joi from 'joi';

import 'dotenv/config';

interface EnvVars {
    DB_CONNECTION: string
    DB_HOST: string
    DB_PORT: number
    DB_DATABASE: string
    DB_USERNAME: string
    DB_PASSWORD: string
    TEXTBEE_API_KEY: string
    TEXTBEE_DEVICE_ID: string
    JWT_SECRET: string
    PORT: number
    EXPO_ACCESS_TOKEN: string
    ENABLE_NOTIFICATIONS: boolean
    ENABLE_SMS: boolean
    REPORTS_PUBLIC_BASE_URL: string
    TENANT_ID: string
}

const envSchema = joi
  .object({
    DB_CONNECTION: joi.string().required(),
    DB_HOST: joi.string().required(),
    DB_PORT: joi.number().required(),
    DB_DATABASE: joi.string().required(),
    DB_USERNAME: joi.string().required(),
    DB_PASSWORD: joi.string().required(),
    TEXTBEE_API_KEY: joi.string().required(),
    TEXTBEE_DEVICE_ID: joi.string().required(),
    JWT_SECRET: joi.string().required(),
    PORT: joi.number().default(3000),
    EXPO_ACCESS_TOKEN: joi.string().required(),
    ENABLE_NOTIFICATIONS: joi.boolean().default(false),
    ENABLE_SMS: joi.boolean().default(false),
    REPORTS_PUBLIC_BASE_URL: joi.string().default('http://localhost:3000'),
    TENANT_ID: joi.string().default('main'),
  })
  .unknown(true)
  .required();

const { error, value } = envSchema.validate({
  ...process.env,
});

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export default envVars;
