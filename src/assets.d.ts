declare module '*.png' {
  const imageUrl: string;
  export default imageUrl;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
