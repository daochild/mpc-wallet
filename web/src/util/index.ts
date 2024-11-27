export function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function scrollToElement(event: any, href: string) {
    event.preventDefault();
    const id = href.split('#')[1]
    if (id) {
        const element = document.getElementById(id);
        if (element) {
            const top = element.offsetTop;
            window.scrollBy({
                top: top,
                behavior: 'smooth',
            })
        }
    }
}

export const shortAddress = (address: string) => {
    if (address.length <= 12) return address
    return `${address.slice(0, 6)}...${address.slice(-6)}`
}