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
    TEXTBEE_WEBHOOK_SECRET: string
    APPROVAL_SMS_ENABLED: boolean
    APPROVAL_EXPIRATION_HOURS: number
    APPROVAL_REPLAY_BASE_URL: string
    APPROVAL_CODE_PREFIX: string
    APPROVAL_SHARED_GATEWAY: boolean
    ADMIN_PAPEL_EMAIL: string
    ADMIN_PAPEL_PASSWORD: string
    ADMIN_PAPEL_NAME: string
    ADMIN_PAPEL_PHONE: string
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
    // Aprobaciones del rol Admin Papel (9). Todas opcionales.
    // Secreto de firma del webhook de TextBee (MESSAGE_RECEIVED). Vacío = webhook deshabilitado.
    TEXTBEE_WEBHOOK_SECRET: joi.string().allow('').default(''),
    // SMS de aprobación. Por defecto sigue a ENABLE_NOTIFICATIONS.
    APPROVAL_SMS_ENABLED: joi.boolean().empty('').default(joi.ref('ENABLE_NOTIFICATIONS')),
    APPROVAL_EXPIRATION_HOURS: joi.number().min(1).empty('').default(48),
    // Base para re-ejecutar la solicitud aprobada contra el propio API. Vacío = http://127.0.0.1:${PORT}
    APPROVAL_REPLAY_BASE_URL: joi.string().allow('').default(''),
    // Letra fija para los códigos de este tenant (ej. Q = servicesqps, V = ventpros).
    // Vacío = letra aleatoria. Necesaria cuando varios tenants comparten el mismo TextBee.
    APPROVAL_CODE_PREFIX: joi.string().allow('').pattern(/^[A-Za-z]?$/).default(''),
    // true = el mismo número de TextBee (y su webhook) lo comparten varios tenants:
    // las respuestas sin código o con código de otro tenant se ignoran sin contestar.
    APPROVAL_SHARED_GATEWAY: joi.boolean().empty('').default(false),
    // Seed idempotente del usuario Admin Papel (solo se crea si vienen email y password).
    ADMIN_PAPEL_EMAIL: joi.string().allow('').default(''),
    ADMIN_PAPEL_PASSWORD: joi.string().allow('').default(''),
    ADMIN_PAPEL_NAME: joi.string().empty('').default('Administrador Papel'),
    ADMIN_PAPEL_PHONE: joi.string().allow('').default(''),
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
