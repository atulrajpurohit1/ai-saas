import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { PredictionEngineService } from './prediction-engine.service';
export declare class AiPredictionsController {
    private readonly predictionEngineService;
    constructor(predictionEngineService: PredictionEngineService);
    dashboard(user: ActiveUser): Promise<import("./ai-predictions.types").PredictionDashboard>;
}
