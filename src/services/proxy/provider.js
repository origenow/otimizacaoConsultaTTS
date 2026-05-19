import fetch from "node-fetch";

export async function getProxyList(token) {
    const myHeaders = new Headers();
    myHeaders.append("Accept", "application/json");
    myHeaders.append("Authorization", `Token ${token}`);

    const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
    };

    return fetch(`https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=2000`, requestOptions)
        .then((response) => response.json())
        .then((result) => result.results)
        .catch((error) => console.error(error));
}
