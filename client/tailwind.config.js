/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                origenow: {
                    purple: '#7B3FE4',
                    fire: '#FFAA00',
                    cold: '#718096',
                    green: '#38A169',
                }
            },
            fontFamily: {
                sans: ['Quicksand', 'sans-serif'],
                mono: ['Fira Code', 'monospace'],
            }
        },
    },
    plugins: [],
}
