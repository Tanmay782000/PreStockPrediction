import axios from "axios";

async function fetchStockPrice() {
    // Your EC2 Elastic IP
    const ec2_url = "http://15.207.159.248:3000/get-price";
    
    const payload = {
        apiKey: "uVNH5DtC", // e.g., "uVNH5DtC"
        client_code: "AACG661827", // e.g., "AACG661827"
        jwtToken: "eyJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6IkFBQ0c2NjE4MjciLCJyb2xlcyI6MCwidXNlcnR5cGUiOiJVU0VSIiwidG9rZW4iOiJleUpoYkdjaU9pSlNVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKMWMyVnlYM1I1Y0dVaU9pSmpiR2xsYm5RaUxDSjBiMnRsYmw5MGVYQmxJam9pZEhKaFpHVmZZV05qWlhOelgzUnZhMlZ1SWl3aVoyMWZhV1FpT2pNc0luTnZkWEpqWlNJNklqTWlMQ0prWlhacFkyVmZhV1FpT2lJd05UWmhaRGs1WWkxaE1qWTFMVE5tTkdVdFlXSmlOaTA1T0RabFltSTNOalk0Wm1JaUxDSnJhV1FpT2lKMGNtRmtaVjlyWlhsZmRqSWlMQ0p2Ylc1bGJXRnVZV2RsY21sa0lqb3pMQ0p3Y205a2RXTjBjeUk2ZXlKa1pXMWhkQ0k2ZXlKemRHRjBkWE1pT2lKaFkzUnBkbVVpZlN3aWJXWWlPbnNpYzNSaGRIVnpJam9pWVdOMGFYWmxJbjE5TENKcGMzTWlPaUowY21Ga1pWOXNiMmRwYmw5elpYSjJhV05sSWl3aWMzVmlJam9pUVVGRFJ6WTJNVGd5TnlJc0ltVjRjQ0k2TVRjM056Y3lPREUyTml3aWJtSm1Jam94TnpjM05qUXhOVGcyTENKcFlYUWlPakUzTnpjMk5ERTFPRFlzSW1wMGFTSTZJbUUyWWpReFpUQmpMVFkzWVRrdE5EUTJOaTA0TVRSaUxXWTNOMlprTkROaVlqQTRZU0lzSWxSdmEyVnVJam9pSW4wLktFMjJ4ZTFLNGxpVWRxVTlvZnhyNE4wanNwYkFjdDBETTN4VklvemRnaVNNU041R1JKVzJqZXN6d3NhMkZsenU2U1Q5MnRKRXhVN0lRSG1YZlhzczZweElRUzZHckk4d3VUdFZYQWtCRUV6OWxfMEpKNU9UaXRhblRBWDg1bUwwN0kzRWVpV0xxQUpoVElwQ3hKS2xTMEZoX3hDQlVUVW93cG1SZHVDZnZQVSIsIkFQSS1LRVkiOiJ1Vk5INUR0QyIsImlhdCI6MTc3NzY0MTc2NiwiZXhwIjoxNzc3NjYwMjAwfQ.KFOzG53_pW0iephENfxxyO51H5iz1wHLuM9rZgh5UjXdwNJn-xagQ9Lh09zTZwBEuO4PCqMMalMKcdukic7vGQ", // Paste that long string here
        exchange: "NSE",
        symboltoken: "3045" // SBIN-EQ
    };

    try {
        const response = await axios.post(ec2_url, payload);
        
        console.log("Response Received:", response.data);
        return {
            status: "Success",
            data: response.data
        };
    } catch (error) {
        // If the token is expired, this will catch the 401/500 error from EC2
        console.error("Lambda Error:", error.response ? error.response.data : error.message);
        return { 
            status: "Error", 
            message: error.message 
        };
    }
};

await fetchStockPrice();