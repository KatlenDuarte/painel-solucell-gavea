import { BookingWidget } from "../components/BookingWidget";
import { useSite } from "../lib/SiteContext";

export function BookPage() {
  const { content } = useSite();
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 pt-28 md:px-8 md:pt-36">
      <div className="label mb-4 text-accent">Reservas</div>
      <h1 className="display text-5xl md:text-6xl">Datas disponíveis</h1>
      <p className="mb-14 mt-4 max-w-2xl text-ink-soft">
        Escolha a cabana e o período, veja o valor de cada noite e envie sua pré-reserva pelo WhatsApp. A equipe do {content.general.name}{" "}
        responde confirmando a disponibilidade e como pagar o sinal.
      </p>
      <BookingWidget />
    </section>
  );
}
