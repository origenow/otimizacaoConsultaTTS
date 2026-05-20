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

    const endpoint = new URL('https://proxy.webshare.io/api/v2/proxy/list/');
    endpoint.searchParams.set('mode', 'direct');
    endpoint.searchParams.set('page', '1');
    endpoint.searchParams.set('page_size', '2000');
    return fetch(endpoint.toString(), requestOptions)
        .then((response) => response.json())
        .then((result) => result.results)
        .catch((error) => console.error(error));
}
