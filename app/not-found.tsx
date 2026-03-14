import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#101622] flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-3xl font-bold text-white mb-4">404 - Página Não Encontrada</h2>
      <p className="text-slate-400 mb-8">Desculpe, a página que você está procurando não existe.</p>
      <Link 
        href="/"
        className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl transition-all"
      >
        Voltar para o Início
      </Link>
    </div>
  );
}
