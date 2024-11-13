import * as dotenv from "dotenv";
import express from "express";
import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";
import { format, parseISO } from "date-fns";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000; // Use PORT environment variable or default to 3000

app.use(express.json()); // Middleware to parse JSON

// Resolve __dirname for ES module
const __file_name = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__file_name);

// Google Sheets API setup
const sheets = google.sheets("v4");
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "credentials.json"), // Path to your service account file
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});



// Load Swagger document
const swaggerDocument = YAML.load(path.join(__dirname, "swagger.yaml"));

// Function to get sheet names and create a mapping
async function get_sheet_names() {
    const authClient = await auth.getClient();
    const response = await sheets.spreadsheets.get({
        auth: authClient,
        spreadsheetId: process.env.SPREADSHEET_ID, // Use SPREADSHEET_ID environment variable
    });

    return response.data.sheets.map((sheet) => sheet.properties.title);
}

// Function to find sheet by date range
async function find_sheet_by_date_range(startDate, endDate) {
    const sheetNames = await get_sheet_names();

    const formatted_start_date = format(parseISO(startDate), "MM/dd");
    const formatted_end_date = format(parseISO(endDate), "MM/dd/yyyy");

    return sheetNames.find((sheetName) => {
        const match = sheetName.match(
            /(\d{2}\/\d{1,2})-(\d{1,2}\/\d{2})\/(\d{4})/,
        );

        if (match) {
            const [, start, end, year] = match;
            const sheetStartDate = new Date(`${start}/${year}`);
            const sheetEndDate = new Date(`${end}/${year}`);
            return (
                sheetStartDate <= new Date(startDate) &&
                sheetEndDate >= new Date(endDate)
            );
        }
        return (
            sheetName.includes(formatted_start_date) ||
            sheetName.includes(formatted_end_date)
        );
    });
}

// Function to fetch data from a sheet
async function fetch_data_from_sheet(sheetName) {
    const authClient = await auth.getClient();
    const response = await sheets.spreadsheets.values.get({
        auth: authClient,
        spreadsheetId: process.env.SPREADSHEET_ID, // Use SPREADSHEET_ID environment variable
        range: `'${sheetName}'`, // Fetch all columns
    });

    const rows = response.data.values;
    if (rows && rows.length > 1) {
        // Check if there is data and skip the first row (header)
        return rows.slice(1).map((row) => ({
            date: row[0],
            project_name: row[1],
            from_time: row[2],
            to_time: row[3],
            task_url: row[4],
            original_url: row[5],
            description: row[6],
        }));
    }
    return [];
}

// Function to filter data by original_url
function filter_by_original_url(data) {
    return data.filter((row) => row.original_url);
}

// Function to filter data by date
function filter_by_date(data) {
    return data.filter((row) => row.date);
}

// Endpoint to list all sheets in the Google Sheet
app.get("/list-sheets", async (req, res) => {
    try {
        const sheetNames = await get_sheet_names();
        res.json({ sheets: sheetNames, status: "success" });
    } catch (error) {
        console.error("Error fetching sheet list from Google Sheets:", error);
        res.status(500).json({ sheets: [], status: "error" });
    }
});

// Endpoint to fetch data from Google Sheets based on date range
app.get("/hours-log/andrew/sheet/:dateRange.json", async (req, res) => {
    const { dateRange } = req.params;
    const match = dateRange.match(/^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})$/);
    if (!match) {
        return res
            .status(400)
            .json({ data: [], status: "invalid date range format" });
    }
    const startDate = match[1];
    const endDate = match[2];
    console.log({ startDate, endDate });
    try {
        const sheetName = await find_sheet_by_date_range(startDate, endDate);

        if (!sheetName) {
            return res
                .status(400)
                .json({ data: [], status: "invalid date range" });
        }

        const data = await fetch_data_from_sheet(sheetName);
        const filteredData = filter_by_original_url(data);
        res.json({ data: filteredData, status: "success" });
    } catch (error) {
        console.error("Error fetching data from Google Sheets:", error);
        res.status(500).json({ data: [], status: "error" });
    }
});


// Endpoint to fetch data from Google Sheets based on date range
app.post("/hours-log/andrew/sheet.json", async (req, res) => {
    const { dateRange, original_url } = req.body;
    const match = dateRange.match(/^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})$/);
    if (!match) {
        return res
            .status(400)
            .json({ data: [], status: "invalid date range format" });
    }
    const startDate = match[1];
    const endDate = match[2];
    console.log({ startDate, endDate });
    try {
        const sheetName = await find_sheet_by_date_range(startDate, endDate);

        if (!sheetName) {
            return res
                .status(400)
                .json({ data: [], status: "invalid date range" });
        }

        let data = await fetch_data_from_sheet(sheetName);

        // Filter data based on original_url if it exists and is not an empty string
        if (original_url && original_url.trim() !== "") {
            data = data.filter(item => item.original_url === original_url);
        }

        data = filter_by_original_url(data);

        // Return the filtered data
        res.status(200).json({total: data.length, status: "success" , data});

    } catch (error) {
        console.error("Error fetching data from Google Sheets:", error);
        res.status(500).json({ data: [], status: "error" });
    }
});


// Endpoint to fetch all data based on date range, original_url, and url
app.post("/hours-log/andrew/sheet/all-data.json", async (req, res) => {
    const { dateRange, original_url, url } = req.body;

    // Validate the date range format
    const match = dateRange.match(/^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})$/);
    if (!match) {
        return res
            .status(400)
            .json({ data: [], status: "invalid date range format" });
    }
    const startDate = match[1];
    const endDate = match[2];
  
    try {
        // Find the correct sheet based on the date range
        const sheetName = await find_sheet_by_date_range(startDate, endDate);
        if (!sheetName) {
            return res
                .status(400)
                .json({ data: [], status: "invalid date range" });
        }

        // Fetch data from the identified sheet
        let data = await fetch_data_from_sheet(sheetName);

        // Filter data by original_url if provided
        if (original_url && original_url.trim() !== "") {
            data = data.filter(item => item.original_url === original_url);
        }

        // Filter data by url if provided
        if (url && url.trim() !== "") {
            data = data.filter(item => item.task_url === url);
        }

        // Filter data by date if provided
        const filteredData = filter_by_date(data);

        // Return the filtered data
        res.status(200).json({total: filteredData.length, status: "success", filteredData });
        
    } catch (error) {
        console.error("Error fetching data from Google Sheets:", error);
        res.status(500).json({ data: [], status: "error" });
    }
});


// Endpoint to fetch all data from the start of the month to today
app.get(
    "/hours-log/andrew/sheet/all-data/:dateRange.json",
    async (req, res) => {
        const { dateRange } = req.params;
        const match = dateRange.match(
            /^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})$/,
        );
        if (!match) {
            return res
                .status(400)
                .json({ data: [], status: "invalid date range format" });
        }
        const startDate = match[1];
        const endDate = match[2];
        console.log({ startDate, endDate });
        try {
            const sheetName = await find_sheet_by_date_range(
                startDate,
                endDate,
            );

            if (!sheetName) {
                return res
                    .status(400)
                    .json({ data: [], status: "invalid date range" });
            }

            const data = await fetch_data_from_sheet(sheetName);
            const filteredData = filter_by_date(data);
            res.json({ data: filteredData, status: "success" });
        } catch (error) {
            console.error("Error fetching data from Google Sheets:", error);
            res.status(500).json({ data: [], status: "error" });
        }
    },
);


// Use swagger-ui-express for your app documentation endpoint
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


// Middleware to handle 404 errors
app.use((req, res) => {
    res.status(404).json({
        message: `Endpoint not found -> url /`,
        status: "error",
    });
});



app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
