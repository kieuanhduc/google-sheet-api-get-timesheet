import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";

const __file_name = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__file_name);

const sheets = google.sheets("v4");
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "../credentials.json"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

export async function get_sheet_names() {
    const authClient = await auth.getClient();
    const response = await sheets.spreadsheets.get({
        auth: authClient,
        spreadsheetId: process.env.SPREADSHEET_ID,
    });
    return response.data.sheets.map((sheet) => sheet.properties.title);
}

export function parse_sheet_date_range(sheetName) {
    const match = sheetName.match(/(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
        const [ , startMonth, startDay, endMonth, endDay, year ] = match;
        return {
            startDate: new Date(`${year}-${startMonth}-${startDay}`),
            endDate: new Date(`${year}-${endMonth}-${endDay}`),
        };
    }
    return null;
}

export async function find_sheet_by_date_range(startDate, endDate) {
    const sheetNames = await get_sheet_names();
    return sheetNames
        .filter((name) => !name.includes("Thông tin tài khoản"))
        .map((name) => ({ name, ...parse_sheet_date_range(name) }))
        .filter(
            (sheet) =>
                sheet.startDate &&
                sheet.endDate &&
                sheet.startDate <= new Date(endDate) &&
                sheet.endDate >= new Date(startDate),
        );
}

export async function fetch_data_from_sheet(sheetNames) {
    const authClient = await auth.getClient();
    const allData = [];

    for (const { name: sheetName } of sheetNames) {
        try {
            const response = await sheets.spreadsheets.values.get({
                auth: authClient,
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: `'${sheetName}'`,
            });
            const rows = response.data.values;

            if (rows && rows.length > 1) {
                allData.push(
                    ...rows.slice(1)
                        .filter(row => row[0] && row[0].trim() !== "") 
                        .map((row) => ({
                            date: row[0],
                            project_name: row[1],
                            from_time: row[2],
                            to_time: row[3],
                            task_url: row[4],
                            original_url: row[5],
                            description: row[6],
                        })),
                );
            }
        } catch (error) {
            console.error(`Error fetching data from sheet ${sheetName}:`, error);
        }
    }

    return allData.sort((a, b) => new Date(b.date) - new Date(a.date));
}