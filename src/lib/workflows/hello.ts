async function greet(name: string) {
  "use step";
  return `hello, ${name}`;
}

export async function hello(name: string) {
  "use workflow";
  const greeting = await greet(name);
  return { greeting };
}
