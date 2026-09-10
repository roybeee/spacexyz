declare namespace Cloudflare {
    interface Env {
        DB?: D1Database;
        SPATIAL_CONNECTION_KEY?: string;
        OPENAI_API_KEY?: string;
        OPENAI_MODEL?: string;
        OPENAI_IMAGE_MODEL?: string;
        BUCKET?: R2Bucket;
    }
}
