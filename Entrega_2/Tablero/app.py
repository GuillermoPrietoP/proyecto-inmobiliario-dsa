from pathlib import Path
import numpy as np
import pandas as pd
import streamlit as st
import plotly.express as px
from core import load_data, summary, fit_model, TARGET, FEATURES

st.set_page_config(page_title='Eje Cafetero | Mercado inmobiliario', page_icon='🏡', layout='wide')
st.markdown('''<style>.stApp{background:#f6f7f4} h1,h2,h3{color:#173e32} [data-testid="stMetric"]{background:white;border:1px solid #dce4dc;padding:16px;border-radius:12px} .block-container{padding-top:2rem} </style>''', unsafe_allow_html=True)
COLORS = ['#24634d','#b47b43','#608c81','#d1a95a','#7e8098','#a65f55']
@st.cache_data
def data(path): return load_data(path)
@st.cache_resource
def trained(path, stamp): return fit_model(load_data(path))
def money(x):
    return f"COP {x / 1_000_000:.2f} M".replace(".", ",")
def chart(fig):
    fig.update_layout(paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)', font_color='#173e32', legend_title_text='Municipio')
    st.plotly_chart(fig, width='stretch')

path = Path(__file__).parent/'datos'/'datos_modelos_completo.csv'
try: df = data(str(path))
except Exception as exc:
    st.error(f'No se pudo cargar la base: {exc}'); st.stop()
st.sidebar.title('🏡 Eje Cafetero')
page = st.sidebar.radio('Explorar', ['Inicio','Por municipio','Comparación','Cobertura','Alertas','Estimaciones','Mi estudio','Proyecto'])
municipios = st.sidebar.multiselect('Municipios', sorted(df.municipio.unique()), default=sorted(df.municipio.unique()))
a,b = int(df.year_radica.min()),int(df.year_radica.max())
years = st.sidebar.slider('Periodo histórico',a,b,(a,b))
st.sidebar.caption('Valores en COP constantes de diciembre de 2023. Registros de operaciones, no inmuebles únicos.')
f = df[df.municipio.isin(municipios) & df.year_radica.between(*years)]
st.title('Análisis inmobiliario urbano')
st.caption('EJE CAFETERO · REGISTROS 2015–2023 · PROTOTIPO ACADÉMICO')
st.header(page)
if f.empty:
    st.info('Selecciona al menos un municipio y un periodo con datos.');st.stop()
s = summary(f)

if page in ['Inicio','Comparación']:
    c1,c2,c3=st.columns(3)
    c1.metric('Operaciones seleccionadas',f'{len(f):,}'.replace(',','.'))
    c2.metric('Mediana registrada',money(f[TARGET].median()))
    c3.metric('Municipios seleccionados',len(s))
    chart(px.bar(s,x='municipio',y='operaciones',color='municipio',color_discrete_sequence=COLORS,labels={'municipio':'Municipio','operaciones':'Operaciones'},title='Actividad transaccional en la selección'))
    chart(px.bar(s,x='municipio',y='mediana',color='municipio',color_discrete_sequence=COLORS,labels={'municipio':'Municipio','mediana':'Mediana · COP de 2023'},title='Valores registrados: comparación de medianas'))
    yearly=f.groupby(['year_radica','municipio'])[TARGET].median().reset_index()
    chart(px.line(yearly,x='year_radica',y=TARGET,color='municipio',markers=True,color_discrete_sequence=COLORS,labels={'year_radica':'Año','valor_real_2023':'Mediana · COP de 2023'},title='Evolución histórica del valor central'))
    
    tabla = s.rename(columns={
        'municipio': 'Municipio',
        'operaciones': 'Operaciones',
        'mediana': 'Mediana',
        'q1': 'Q1',
        'q3': 'Q3'
    }).copy()

    for columna in ['Mediana', 'Q1', 'Q3']:
        tabla[columna] = tabla[columna] / 1_000_000

    st.subheader('Resumen comparativo por municipio')
    st.caption('Valores monetarios en millones de COP constantes de 2023')

    st.dataframe(
        tabla,
        hide_index=True,
        width='stretch',
        column_config={
            'Municipio': st.column_config.TextColumn('Municipio'),
            'Operaciones': st.column_config.NumberColumn(
                'Operaciones', format='%,d'
            ),
            'Mediana': st.column_config.NumberColumn(
                'Mediana (M COP)', format='%.1f'
            ),
            'Q1': st.column_config.NumberColumn(
                'Q1 (M COP)', format='%.1f'
            ),
            'Q3': st.column_config.NumberColumn(
                'Q3 (M COP)', format='%.1f'
            )
        }
    )

    st.caption('Un mayor volumen de registros no prueba rentabilidad ni permite comparar inmuebles equivalentes.')
elif page=='Por municipio':
    m=st.selectbox('Municipio a consultar',sorted(f.municipio.unique()))
    g=f[f.municipio==m]; last=years[1]
    n=len(df[(df.municipio==m)&(df.year_radica==last)])
    prev=len(df[(df.municipio==m)&(df.year_radica==last-1)])
    c1,c2,c3=st.columns(3)
    c1.metric(f'Operaciones en {last}',n, f'{(n/prev-1)*100:.1f}% frente a {last-1}' if prev else None)
    c2.metric('Mediana del periodo',money(g[TARGET].median()))
    c3.metric('Mitad central del periodo',f'{g[TARGET].quantile(.25)/1e6:.1f}–{g[TARGET].quantile(.75)/1e6:.1f} M COP')
    annual=g.groupby('year_radica').agg(operaciones=(TARGET,'size'),mediana=(TARGET,'median')).reset_index()
    chart(px.bar(annual,x='year_radica',y='operaciones',labels={'year_radica':'Año','operaciones':'Operaciones'},color_discrete_sequence=COLORS))
    chart(px.line(annual,x='year_radica',y='mediana',markers=True,labels={'year_radica':'Año','mediana':'Mediana · COP de 2023'},color_discrete_sequence=COLORS))
elif page=='Cobertura':
    st.metric('Registros en el archivo recibido',f'{len(df):,}')
    st.write('La base recibida ya está filtrada. No incluye el universo previo a la depuración; no se calcula un porcentaje de retención frente a ese universo.')
    st.dataframe(df.isna().sum().rename('Nulos').reset_index().rename(columns={'index':'Columna'}),hide_index=True)
    st.dataframe(pd.crosstab(df.municipio,df.year_radica),width='stretch')
    st.caption('Esta tabla usa todo el archivo; los demás indicadores usan los filtros laterales.')
    st.write('Controles sobre el archivo recibido:',{'valor positivo':bool((df.valor>0).all()),'solo urbano':bool(df.tipo_predio_zona.eq('URBANO').all()),'solo compraventa':bool(df.nombre_natujur.eq('COMPRAVENTA').all()),'sin múltiples valores':bool(df.tiene_mas_de_un_valor.eq(0).all())})
elif page=='Alertas':
    st.info('Exploración de valores extremos. Una señal estadística no demuestra una irregularidad. Este criterio es una propuesta para revisar con el equipo.')
    st.write('Se muestran valores fuera de Q1 − 1,5 × RIQ y Q3 + 1,5 × RIQ, calculados dentro de cada municipio y año de la selección.')
    groups=f.groupby(['municipio','year_radica'])[TARGET]
    q1=groups.transform(lambda x:x.quantile(.25));q3=groups.transform(lambda x:x.quantile(.75));iqr=q3-q1
    flags=f[(iqr>0)&((f[TARGET]<q1-1.5*iqr)|(f[TARGET]>q3+1.5*iqr))].copy()
    flags.insert(0,'fila_csv',flags.index+2)
    st.metric('Registros señalados',len(flags))
    st.dataframe(flags.head(200),hide_index=True)
    st.download_button('Descargar señales de la selección',flags.to_csv(index=False).encode('utf-8-sig'),'senales_revision.csv','text/csv')
elif page=='Estimaciones':
    st.warning('Modelo experimental: municipio y año. No es un avalúo. En la validación global de 2022, la mediana municipal supera al Random Forest logarítmico.')
    st.caption('Entrenamiento: 2015–2021. Validación: 2022. No se utiliza 2023 para ajustar ni seleccionar el modelo. El primer entrenamiento puede tardar.')
    with st.spinner('Preparando modelo y métricas…'):
        model,medians,metrics=trained(str(path),path.stat().st_mtime_ns)
    m=st.selectbox('Municipio de la estimación',sorted(medians.index))
    year=st.selectbox('Año de consulta experimental',[2022,2023])
    prediction=float(np.expm1(model.predict(pd.DataFrame([[m,year]],columns=FEATURES)))[0])
    c1,c2=st.columns(2);c1.metric('Random Forest log · COP de 2023',money(prediction));c2.metric('Mediana de entrenamiento · COP de 2023',money(medians[m]))
    st.caption('La referencia se calcula únicamente con 2015–2021. Los filtros históricos de la barra lateral no reentrenan el modelo. Los árboles no extrapolan tendencias más allá de los años de entrenamiento.')
    st.subheader('Validación 2022: MAE en COP de 2023')
    st.dataframe(metrics,hide_index=True)
    st.download_button('Descargar evaluación',metrics.to_csv(index=False).encode('utf-8-sig'),'evaluacion_2022.csv','text/csv')
elif page=='Mi estudio':
    m=st.selectbox('Municipio a estudiar',sorted(f.municipio.unique()));g=f[f.municipio==m]
    reason=st.text_area('Motivo de la selección','Comparar la actividad y los valores históricos antes de profundizar el estudio del mercado local.')
    report=f'Estudio preliminar: {m}\nPeriodo: {years[0]}–{years[1]}\nOperaciones: {len(g)}\nMediana: {money(g[TARGET].median())}\n{reason}\nLimitaciones: registros, no inmuebles únicos; sin área, ubicación específica ni estado físico. No permite inferir rentabilidad.\nValores en pesos comparables de diciembre de 2023.'
    st.text(report);st.download_button('Descargar mi resumen',report.encode('utf-8'),'mi_estudio.txt','text/plain')
else:
    st.write('Fuente de datos: Registro de Transacciones Inmobiliarias IGAC 2015–2023. Archivo suministrado por el equipo; valores ajustados mediante IPC DANE.')
    st.write('Objetivo: apoyar la selección de municipios para profundizar estudios de inversión mediante actividad transaccional y valores registrados.')
    st.write('Se adapta la maqueta original a seis municipios. Las cifras se calculan a partir del CSV recibido. No se dispone de la base previa a filtros ni de identificadores prediales para enlazar catastro.')
    st.write('El componente experimental reproduce las variables, el algoritmo y la separación temporal del script modelo_base_log.py. Funciona localmente, todavía sin API ni registro automático en MLflow.')
st.divider()
st.caption('IGAC · Base del equipo · COP de diciembre de 2023 · Prototipo académico, no recomendación de inversión ni avalúo.')
