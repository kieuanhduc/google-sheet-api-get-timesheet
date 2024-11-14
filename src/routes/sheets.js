import express from "express";
import { find_sheet_by_date_range, fetch_data_from_sheet, get_sheet_names } from "../utils/googleSheets.js";
import { filter_data } from "../utils/filters.js";

const router = express.Router();

router.get("/list-sheets", async (req, res) => {
    try {
        const sheets = await get_sheet_names();
        res.json({ sheets, status: "success" });
    } catch (error) {
        console.error("Error fetching sheet list:", error);
        res.status(500).json({ sheets: [], status: "error" });
    }
});

router.get("/hours-log/andrew/sheet/:dateRange.json", async (req, res) => {
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
        const sheetNames = await find_sheet_by_date_range(startDate, endDate);

        if (!sheetNames.length) {
            return res.status(400).json({ status: "no sheets found" });
        }
        const data = await fetch_data_from_sheet(sheetNames);
        const filteredData = filter_data(data, { original_url: ""});
        res.json({ total: filteredData.length, status: "success", data: filteredData });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ status: "error" });
    }
});

router.post("/hours-log/andrew/sheet.json", async (req, res) => {
    const { dateRange, original_url } = req.body;
    const match = dateRange.match(/^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})$/);
    if (!match) {
        return res
            .status(400)
            .json({ data: [], status: "invalid date range format" });
    }
    const startDate = match[1];
    const endDate = match[2];
 
    try {
        const sheetNames = await find_sheet_by_date_range(startDate, endDate);
        if (!sheetNames.length) {
            return res.status(400).json({ status: "no sheets found" });
        }
        const data = await fetch_data_from_sheet(sheetNames);
        const filteredData = filter_data(data, { original_url });
        res.json({ total: filteredData.length, status: "success", data: filteredData });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).json({ status: "error" });
    }
});




// Endpoint to fetch all data based on date range, original_url, and url
router.post("/hours-log/andrew/sheet/all-data.json", async (req, res) => {

    let filteredData = [];

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
        const sheetNames = await find_sheet_by_date_range(
            startDate,
            endDate,
        );

        if (!sheetNames.length) {
            return res.status(400).json({ status: "no sheets found" });
        }

        const data = await fetch_data_from_sheet(sheetNames);

        // Filter data by original_url if provided
        if (original_url && original_url.trim() !== "") {
             filteredData = filter_data(data, { original_url });
        }

        // Filter data by url if provided
        if (url && url.trim() !== "") {
             filteredData = filter_data(data, { url });
        }

        if( original_url.trim() == "" && url.trim() == "" ){
            filteredData = filter_data(data);
        }

        res.json({ total: filteredData.length, status: "success", data: filteredData });
        
    } catch (error) {
        console.error("Error fetching data from Google Sheets:", error);
        res.status(500).json({ data: [], status: "error" });
    }
});


// Endpoint to fetch all data from the start of the month to today
router.get(
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
            const sheetNames = await find_sheet_by_date_range(
                startDate,
                endDate,
            );

            if (!sheetNames.length) {
                return res.status(400).json({ status: "no sheets found" });
            }

            const data = await fetch_data_from_sheet(sheetNames);
            const filteredData = filter_data(data);
            res.json({ total: filteredData.length, status: "success", data: filteredData });
        } catch (error) {
            console.error("Error fetching data from Google Sheets:", error);
            res.status(500).json({ data: [], status: "error" });
        }
    },
);


export default router;