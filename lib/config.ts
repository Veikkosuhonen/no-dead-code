export const isDeno = () => {
    // @ts-ignore
    return typeof Deno !== "undefined"
}