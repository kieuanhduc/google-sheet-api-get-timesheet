import * as dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import sheetsRouter from "./routes/sheets.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const __file_name = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__file_name);

const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));


// Use the sheets router
app.use("/", sheetsRouter);

// Use swagger-ui-express for your app documentation endpoint
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument));


// 404 Handler
app.use((req, res) => res.status(404).json({ message: "Endpoint not found", status: "error" }));

// Start Server
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));