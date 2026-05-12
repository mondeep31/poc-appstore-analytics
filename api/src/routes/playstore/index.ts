import { Hono } from "hono";

import overview from "./overview.ts";
import trend from "./trend.ts";
import countries from "./countries.ts";
import playstoreReviews from "./playstore-reviews.ts";
import crashesTrend from "./crashes-trend.ts";
import crashesDevices from "./crashes-devices.ts";
import crashesAppVersions from "./crashes-app-versions.ts";
import crashesOsVersions from "./crashes-os-versions.ts";
import crashesDimensionTrends from "./crashes-dimension-trends.ts";

const playstoreRouter = new Hono();
playstoreRouter.route("/overview", overview);
playstoreRouter.route("/trend", trend);
playstoreRouter.route("/countries", countries);
playstoreRouter.route("/reviews", playstoreReviews);
playstoreRouter.route("/crashes/trend", crashesTrend);
playstoreRouter.route("/crashes/devices", crashesDevices);
playstoreRouter.route("/crashes/app-versions", crashesAppVersions);
playstoreRouter.route("/crashes/os-versions", crashesOsVersions);
playstoreRouter.route("/crashes/dimension-trends", crashesDimensionTrends);

export default playstoreRouter;
