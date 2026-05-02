import axios from "axios";

const data = {
  clientcode: "AACG661827",
  password: "7820",
  totp: "975599",
  state: "STATE_VARIABLE",
};

const config = {
  method: "post",
  url: "https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "CLIENT_LOCAL_IP",
    "X-ClientPublicIP": "CLIENT_PUBLIC_IP",
    "X-MACAddress": "MAC_ADDRESS",
    "X-PrivateKey": "uVNH5DtC",
  },
  data: data,
};

axios(config)
  .then((response) => {
    console.log(response.data);
  })
  .catch((error) => {
    console.error(error.response?.data || error.message);
  });