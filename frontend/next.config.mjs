/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination: "https://app.tastyrock.com/api/:path*",
            },
            {
                source: "/ws/:path*",
                destination: "https://app.tastyrock.com/ws/:path*",
            },
        ];
    },
};

export default nextConfig;