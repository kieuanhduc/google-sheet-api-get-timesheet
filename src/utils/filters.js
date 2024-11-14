export function filter_data(data, filters = {}) {
    let filtered = data;

    for (const [key, value] of Object.entries(filters)) {
        switch (key) {
            case 'original_url':
                if(value === ''){
                    filtered = filtered.filter((row) => row.original_url);
                }else{
                    filtered = filtered.filter((row) => row.original_url && row.original_url === value);
                }
                break;
            case 'url':
                if(value === ''){
                    filtered = filtered.filter((row) => row.task_url);
                }else{
                    filtered = filtered.filter((row) => row.task_url && row.task_url === value);
                }
               
                break;
            // Add more cases if needed
            default:
                filtered = filtered.filter((row) => row.date);
        }
    }

    return filtered;
}