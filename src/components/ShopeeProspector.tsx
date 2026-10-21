import {useEffect,useState} from 'react';
import {Search,ShoppingBag,Heart,ArrowRight} from 'lucide-react';

export interface ShopeeProduct {id:string;name:string;shop:string;price:number;priceMax:number;sales:number;rating:number;commissionRate:number;image:string;url:string;affiliateUrl:string;checkedAt:string;}
const BASE=import.meta.env.VITE_API_URL?`${import.meta.env.VITE_API_URL.replace(/\/$/,'')}/api`:'/api';
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function request(path:string,init?:RequestInit){const response=await fetch(BASE+'/shopee'+path,init);const data=await response.json();if(!response.ok)throw new Error(data.error??'Falha na Shopee');return data;}

export default function ShopeeProspector({onPrepare}:{onPrepare:(product:ShopeeProduct)=>void}){
  const [configured,setConfigured]=useState(false),[keyword,setKeyword]=useState(''),[sort,setSort]=useState('2');
  const [products,setProducts]=useState<ShopeeProduct[]>([]),[favorites,setFavorites]=useState<ShopeeProduct[]>([]);
  const [view,setView]=useState<'search'|'favorites'>('search'),[page,setPage]=useState(1),[hasNext,setHasNext]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[searched,setSearched]=useState(false);
  const [min,setMin]=useState(''),[max,setMax]=useState(''),[lastQuery,setLastQuery]=useState('');
  useEffect(()=>{request('/status').then(status=>setConfigured(status.configured)).catch(e=>setError(e.message));request('/favorites').then(setFavorites).catch(e=>setError(e.message));},[]);
  const search=async(nextPage=1)=>{
    setBusy(true);setError('');
    try{
      const data=await request('/products?'+new URLSearchParams({keyword,sort,page:String(nextPage)}));
      setProducts(data.products);setPage(data.page);setHasNext(data.hasNextPage);setSearched(true);setView('search');setLastQuery(JSON.stringify([keyword,sort]));
    }catch(e){setError(e instanceof Error?e.message:'Erro na consulta');}
    finally{setBusy(false);}
  };
  const items=(view==='favorites'?favorites:products).filter(product=>(!min||product.price>=Number(min))&&(!max||product.price<=Number(max)));
  const save=async(product:ShopeeProduct)=>{
    setBusy(true);setError('');
    try{
      if(favorites.some(item=>item.id===product.id)){
        await request('/favorites/'+encodeURIComponent(product.id),{method:'DELETE'});setFavorites(prev=>prev.filter(item=>item.id!==product.id));
      }else{
        const saved=await request('/favorites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(product)});setFavorites(prev=>[saved,...prev]);
      }
    }catch(e){setError(e instanceof Error?e.message:'Erro ao salvar');}
    finally{setBusy(false);}
  };

  return <section className="studio-card shopee-prospector" aria-label="Garimpo Shopee">
    <header className="tool-panel-heading"><div><h2><ShoppingBag size={20}/>Garimpo Shopee</h2><p className="studio-muted">Encontre produtos para divulgar, salve suas escolhas e prepare uma publicação.</p></div></header>
    <nav className="tool-tabs" aria-label="Produtos da Shopee">
      <button type="button" className={`tool-tab${view==='search'?' is-active':''}`} aria-pressed={view==='search'} onClick={()=>setView('search')}><Search size={16}/>Buscar produtos</button>
      <button type="button" className={`tool-tab${view==='favorites'?' is-active':''}`} aria-pressed={view==='favorites'} onClick={()=>setView('favorites')}><Heart size={16}/>Favoritos ({favorites.length})</button>
    </nav>
    {error&&<p className="studio-error" role="alert">{error}</p>}
    {view==='search'&&<section className="tool-section">
      <div className="tool-section-heading"><h3>O que você quer divulgar?</h3></div>
      {!configured&&<p className="studio-notice">A busca precisa de configuração: adicione SHOPEE_APP_ID e SHOPEE_APP_SECRET no .env do servidor.</p>}
      <form onSubmit={e=>{e.preventDefault();void search();}}>
        <div className="studio-pair">
          <label className="studio-field">Produto ou categoria<input required minLength={2} maxLength={80} value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="Ex.: caneca, organizador, beleza"/><small>Digite pelo menos 2 caracteres para buscar.</small></label>
          <label className="studio-field">Ordenar resultados<select value={sort} onChange={e=>setSort(e.target.value)}><option value="2">Mais vendidos</option><option value="5">Maior comissão</option><option value="4">Menor preço</option><option value="3">Maior preço</option><option value="1">Relevância</option></select></label>
        </div>
        <div className="tool-actions"><button className="studio-primary" disabled={busy||!configured}><Search size={16}/>{busy?'Buscando…':'Buscar produtos'}</button></div>
      </form>
    </section>}
    <section className="tool-section">
      <div className="tool-section-heading"><h3>{view==='favorites'?'Produtos favoritos':'Resultados da busca'}</h3>{(searched||view==='favorites')&&<span className="studio-muted">{items.length} {items.length===1?'produto':'produtos'} nesta lista</span>}</div>
      {view==='favorites'&&<p className="studio-muted">Seus produtos salvos ficam aqui. Escolha um para continuar a preparação do vídeo.</p>}
      {(searched||view==='favorites')&&<>
        <div className="studio-pair">
          <label className="studio-field">Preço mínimo (R$)<input type="number" min="0" step="0.01" value={min} onChange={e=>setMin(e.target.value)} placeholder="Sem mínimo"/></label>
          <label className="studio-field">Preço máximo (R$)<input type="number" min="0" step="0.01" value={max} onChange={e=>setMax(e.target.value)} placeholder="Sem máximo"/></label>
        </div>
        <p className="studio-muted">O filtro de preço considera os produtos carregados nesta lista.</p>
      </>}
      <div className="shopee-products" aria-busy={busy}>{items.map(product=>{
        const favorite=favorites.some(item=>item.id===product.id);
        return <article className="shopee-product" key={product.id}>
          {product.image&&<img src={product.image} alt="" loading="lazy" referrerPolicy="no-referrer"/>}
          <h3>{product.name}</h3><p>{product.shop}</p>
          <strong>{money(product.price)}{product.priceMax>product.price?` a ${money(product.priceMax)}`:''}</strong>
          <p>{product.sales.toLocaleString('pt-BR')} vendidos · Avaliação: {product.rating||'Não informada'}</p>
          <p>Comissão: {(product.commissionRate*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%<br/>Estimada a partir de {money(product.price*product.commissionRate)}</p>
          <small>Consultado em {new Date(product.checkedAt).toLocaleString('pt-BR')}</small>
          <a href={product.url} target="_blank" rel="noreferrer">Ver produto na Shopee ↗</a>
          <button className="studio-secondary" disabled={busy} aria-pressed={favorite} onClick={()=>void save(product)}><Heart size={16} fill={favorite?'currentColor':'none'}/>{favorite?'Remover favorito':'Salvar favorito'}</button>
          <button className="studio-primary" disabled={busy} onClick={()=>onPrepare(product)}>Preparar publicação<ArrowRight size={16}/></button>
        </article>;
      })}</div>
      {!items.length&&<div className="tool-empty-state">{view==='favorites'?<Heart size={28}/>:<Search size={28}/>}<h3>{view==='favorites'?(favorites.length?'Nenhum favorito nesta faixa de preço':'Salve seus primeiros favoritos'):searched?'Nenhum produto encontrado':'Sua próxima ideia começa aqui'}</h3><p className="studio-muted">{view==='favorites'?(favorites.length?'Ajuste os filtros de preço para ver mais produtos.':'Na busca, toque em “Salvar favorito” nos produtos que quiser guardar.'):searched?'Experimente outra busca, página ou faixa de preço.':'Busque um produto ou categoria para explorar as ofertas.'}</p></div>}
      {view==='search'&&searched&&<nav className="tool-actions" aria-label="Páginas dos resultados"><button className="studio-secondary" disabled={busy||page<=1||lastQuery!==JSON.stringify([keyword,sort])} onClick={()=>void search(page-1)}>Página anterior</button><span className="studio-muted">Página {page}</span><button className="studio-secondary" disabled={busy||!hasNext||page>=100||lastQuery!==JSON.stringify([keyword,sort])} onClick={()=>void search(page+1)}>Próxima página</button></nav>}
    </section>
    <p className="studio-muted">Os valores e as comissões podem mudar e não representam ganhos garantidos. Ao preparar a publicação, selecione um vídeo autorizado da sua biblioteca. Nenhum vídeo é baixado ou publicado automaticamente.</p>
  </section>;
}
