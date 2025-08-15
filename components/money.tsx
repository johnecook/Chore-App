export function Money({ value }: { value: number }) {
  return <span>${value.toFixed(2)}</span>
}
export const formatMoney = (n: number) => `$${n.toFixed(2)}`