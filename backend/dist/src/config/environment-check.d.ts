export interface EnvironmentReport {
    fatal: string[];
    warnings: string[];
}
export declare function isDevelopmentLike(env?: NodeJS.ProcessEnv): boolean;
export declare function checkEnvironment(env?: NodeJS.ProcessEnv): EnvironmentReport;
export declare function assertEnvironment(env?: NodeJS.ProcessEnv): void;
