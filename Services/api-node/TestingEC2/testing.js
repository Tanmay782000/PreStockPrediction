import axios from "axios";

async function fetchStockPrice() {
    // Your EC2 Elastic IP
    const ec2_url = "http://15.207.159.248:3000/get-price";
    
    const payload = {
        apiKey: "uVNH5DtC", // e.g., "uVNH5DtC"
        client_code: "AACG661827", // e.g., "AACG661827"
        jwtToken: "eyJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6IkFBQ0c2NjE4MjciLCJyb2xlcyI6MCwidXNlcnR5cGUiOiJVU0VSIiwidG9rZW4iOiJleUpoYkdjaU9pSlNVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKMWMyVnlYM1I1Y0dVaU9pSmpiR2xsYm5RaUxDSjBiMnRsYmw5MGVYQmxJam9pZEhKaFpHVmZZV05qWlhOelgzUnZhMlZ1SWl3aVoyMWZhV1FpT2pNc0luTnZkWEpqWlNJNklqTWlMQ0prWlhacFkyVmZhV1FpT2lJd05UWmhaRGs1WWkxaE1qWTFMVE5tTkdVdFlXSmlOaTA1T0RabFltSTNOalk0Wm1JaUxDSnJhV1FpT2lKMGNtRmtaVjlyWlhsZmRqSWlMQ0p2Ylc1bGJXRnVZV2RsY21sa0lqb3pMQ0p3Y205a2RXTjBjeUk2ZXlKa1pXMWhkQ0k2ZXlKemRHRjBkWE1pT2lKaFkzUnBkbVVpZlN3aWJXWWlPbnNpYzNSaGRIVnpJam9pWVdOMGFYWmxJbjE5TENKcGMzTWlPaUowY21Ga1pWOXNiMmRwYmw5elpYSjJhV05sSWl3aWMzVmlJam9pUVVGRFJ6WTJNVGd5TnlJc0ltVjRjQ0k2TVRjM056YzVPVEF3TlN3aWJtSm1Jam94TnpjM056RXlOREkxTENKcFlYUWlPakUzTnpjM01USTBNalVzSW1wMGFTSTZJamd4T1RRM1pUQTBMVE0zWWprdE5HSmpaUzA1WXpFeExUUXhNVGxpTkRJelpERXpNaUlzSWxSdmEyVnVJam9pSW4wLmg4N0cxbXRCalBfZDVoejR1R2Y4QkNBSHdZRV9wcmJuenVLYXpMcGlIZnBGU3d4VVE3US01MWRWVDVRYkE5YTh4S1otMDZDeU9xZVpmVklpLTA0SEY0aDVNd1BHS2hrTmZGWFBac2tUa2V5ZEk3NDRSbXkzOWdPTFR0ZkRYcWh3Z05VT3Qxdk9zbkRaMVoybXNFb2Zzc2F0eGl1NGdQUzVvN1FpWUx0bkdvUSIsIkFQSS1LRVkiOiJ1Vk5INUR0QyIsImlhdCI6MTc3NzcxMjYwNSwiZXhwIjoxNzc3NzQ2NjAwfQ.wRQFOV2kZAJlUlYVzOy4io5W7yGgBIh9DfAmHBfKQFVr_JNqdwIY7ZY9pHDuRJ0n-FsKNoK1boFeMs3caPvFVQ", // Paste that long string here
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