package dev.satflow.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Local web UI plus an on-device PDF reader. No remote JS receives the bridge. */
public class MainActivity extends Activity {
 private static final String ORIGIN="https://satflow.local/";
 private static final int IMPORT_PDF=20, EXPORT_JSON=21, PICK_FILE=22;
 private WebView web;
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final Map<String,JSONObject> sources=new HashMap<>(), questions=new HashMap<>();
 private ValueCallback<Uri[]> fileCallback;
 private String exportData;

 @Override public void onCreate(Bundle saved) {
  super.onCreate(saved);
  try {
   JSONObject index=new JSONObject(readAsset("official-index.json"));
   JSONArray ss=index.getJSONArray("sources"),qs=index.getJSONArray("questions");
   for(int i=0;i<ss.length();i++){JSONObject s=ss.getJSONObject(i);sources.put(s.getString("id"),s);}
   for(int i=0;i<qs.length();i++){JSONObject q=qs.getJSONObject(i);questions.put(q.getString("id"),q);}
  }catch(Exception e){throw new IllegalStateException("Bundled practice index is invalid",e);}
  web=new WebView(this);web.setBackgroundColor(Color.rgb(16,19,21));setContentView(web);
  // Android 15 enforces edge-to-edge: keep interactive content outside system bars.
  web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportMultipleWindows(false);
  web.addJavascriptInterface(new Bridge(),"Android");
  web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
    String u=request.getUrl().toString();
    if(!u.startsWith(ORIGIN))return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",new HashMap<>(),new ByteArrayInputStream(new byte[0]));
    String p=request.getUrl().getPath();if(p==null||p.equals("/"))p="/index.html";
    String f=p.substring(1);
    if(!f.matches("[a-zA-Z0-9._-]+"))return response(404,"text/plain",new byte[0]);
    try {String mime=f.endsWith(".js")?"text/javascript":f.endsWith(".css")?"text/css":f.endsWith(".json")||f.endsWith(".webmanifest")?"application/json":f.endsWith(".svg")?"image/svg+xml":"text/html";
     return new WebResourceResponse(mime,"UTF-8",getAssets().open(f));
    }catch(IOException e){return response(404,"text/plain",new byte[0]);}
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    if(request.getUrl().toString().startsWith(ORIGIN))return false;
    openExternalSafe(request.getUrl().toString());return true;
   }
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
    if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
    Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");
    try{startActivityForResult(i,PICK_FILE);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;}return true;
   }
  });
  web.loadUrl(ORIGIN+"index.html");
 }
 private WebResourceResponse response(int status,String mime,byte[] bytes){return new WebResourceResponse(mime,"UTF-8",status,status==404?"Not Found":"OK",new HashMap<>(),new ByteArrayInputStream(bytes));}
 private String readAsset(String filename)throws IOException{try(InputStream in=getAssets().open(filename)){return new String(readAll(in,6*1024*1024),StandardCharsets.UTF_8);}}
 private byte[] readAll(InputStream in,int max)throws IOException{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>max)throw new IOException("File exceeds the size limit");out.write(b,0,n);}return out.toByteArray();}
 private void callback(String name,JSONObject value){if(isFinishing())return;runOnUiThread(()->{if(!isFinishing())web.evaluateJavascript("window."+name+"("+value.toString()+")",null);});}
 private JSONObject errorResult(String id,boolean explanation,String request,Exception e){JSONObject r=new JSONObject();try{r.put("id",id);r.put("request",request);r.put("explanation",explanation);r.put("error",e instanceof IOException?e.getMessage():"The PDF could not be rendered. Retry or open the original PDF.");}catch(Exception ignored){}return r;}
 private String sha256(File f)throws Exception{MessageDigest d=MessageDigest.getInstance("SHA-256");try(InputStream in=new FileInputStream(f)){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)d.update(b,0,n);}StringBuilder s=new StringBuilder();for(byte b:d.digest())s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();}
 private File sourceFile(String id,boolean explanation)throws Exception{
  if(id.endsWith("-explanations")){id=id.substring(0,id.length()-13);explanation=true;}
  if(id.startsWith("import-")){File f=new File(getFilesDir(),id+".pdf");if(!id.matches("import-[0-9]+")||!f.isFile())throw new IOException("The imported PDF is missing.");return f;}
  JSONObject s=sources.get(id);if(s==null)throw new IOException("Unknown test source.");
  String url=s.getString(explanation?"explanationUrl":"url"),hash=s.getString(explanation?"explanationSha256":"sha256");
  File dir=new File(getFilesDir(),"official");if(!dir.exists()&&!dir.mkdirs())throw new IOException("Device storage is unavailable.");
  File dest=new File(dir,id+(explanation?"-explanations":"")+".pdf");
  if(dest.isFile()){if(sha256(dest).equals(hash))return dest;dest.delete();}
  URL remote=new URL(url);String host=remote.getHost();if(!"https".equals(remote.getProtocol())||!(host.equals("satsuite.collegeboard.org")||host.equals("cdn.kastatic.org")))throw new IOException("Untrusted download source.");
  HttpURLConnection c=(HttpURLConnection)remote.openConnection();c.setConnectTimeout(20000);c.setReadTimeout(30000);c.setInstanceFollowRedirects(false);c.setRequestProperty("User-Agent","Mozilla/5.0 SATflow/1.0 personal practice");
  File temp=new File(dir,dest.getName()+".part");
  try{
   int status=c.getResponseCode();if(status!=200)throw new IOException("Official host returned HTTP "+status+". The original PDF remains available through the source link.");
   try(InputStream in=c.getInputStream();OutputStream out=new FileOutputStream(temp)){byte[] b=new byte[16384];int count=0,n;while((n=in.read(b))!=-1){count+=n;if(count>50*1024*1024)throw new IOException("PDF exceeds the download size limit.");out.write(b,0,n);}}
   if(!sha256(temp).equals(hash))throw new IOException("The publisher changed this PDF. Open the source link; the question index needs an update.");
   if(!temp.renameTo(dest))throw new IOException("Could not save the PDF on this device.");return dest;
  }finally{temp.delete();c.disconnect();}
 }
 private String render(File file,int pageIndex,JSONArray rect)throws Exception{
  try(ParcelFileDescriptor fd=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer pdf=new PdfRenderer(fd)){
   if(pageIndex<0||pageIndex>=pdf.getPageCount())throw new IOException("PDF page is unavailable.");
   try(PdfRenderer.Page page=pdf.openPage(pageIndex)){
    float x=0,y=0,w=page.getWidth(),h=page.getHeight();
    if(rect!=null){x=(float)rect.getDouble(0);y=(float)rect.getDouble(1);w=(float)rect.getDouble(2)-x;h=(float)rect.getDouble(3)-y;}
    if(w<=0||h<=0)throw new IOException("Question layout is invalid.");float scale=Math.min(3.2f,Math.min(1100f/w,2400f/h));int bw=Math.max(1,Math.round(w*scale)),bh=Math.max(1,Math.round(h*scale));
    Bitmap bitmap=Bitmap.createBitmap(bw,bh,Bitmap.Config.ARGB_8888);bitmap.eraseColor(Color.WHITE);Matrix m=new Matrix();m.setValues(new float[]{scale,0,-x*scale,0,scale,-y*scale,0,0,1});page.render(bitmap,null,m,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
    ByteArrayOutputStream bytes=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.PNG,100,bytes);bitmap.recycle();return Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP);
   }
  }
 }
 private void openExternalSafe(String url){try{Uri u=Uri.parse(url);if(!"https".equals(u.getScheme()))return;runOnUiThread(()->{try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}});}catch(Exception ignored){}}
 public class Bridge {
  @JavascriptInterface public void renderQuestion(String id,boolean explanation,String request){worker.execute(()->{try{JSONObject q=questions.get(id);if(q==null)throw new IOException("Unknown question.");JSONObject layout=explanation?q.getJSONObject("explanation"):q;String data=render(sourceFile(q.getString("source"),explanation),layout.getInt("page"),layout.getJSONArray("rect"));JSONObject r=new JSONObject();r.put("request",request);r.put("image",data);callback("onNativeImage",r);}catch(Exception e){callback("onNativeImage",errorResult(id,explanation,request,e));}});}
  @JavascriptInterface public void renderPage(String id,int page,String request){worker.execute(()->{try{JSONObject r=new JSONObject();r.put("request",request);r.put("image",render(sourceFile(id,false),page,null));callback("onNativeImage",r);}catch(Exception e){callback("onNativeImage",errorResult(id,false,request,e));}});}
  @JavascriptInterface public void openExternal(String url){openExternalSafe(url);}
  @JavascriptInterface public void importPdf(){runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/pdf");try{startActivityForResult(i,IMPORT_PDF);}catch(Exception ignored){}});}
  @JavascriptInterface public String listImports(){try{File meta=new File(getFilesDir(),"imports.json");if(!meta.exists())return "[]";try(InputStream in=new FileInputStream(meta)){return new String(readAll(in,1024*1024),StandardCharsets.UTF_8);}}catch(Exception e){return "[]";}}
  @JavascriptInterface public void exportProgress(String data){if(data.length()>10*1024*1024)return;exportData=data;runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");i.putExtra(Intent.EXTRA_TITLE,"satflow-progress.json");try{startActivityForResult(i,EXPORT_JSON);}catch(Exception ignored){}});}
 }
 @Override protected void onActivityResult(int request,int result,Intent data){
  super.onActivityResult(request,result,data);
  if(request==PICK_FILE){if(fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}return;}
  if(result!=RESULT_OK||data==null||data.getData()==null)return;Uri uri=data.getData();
  if(request==EXPORT_JSON){String payload=exportData;worker.execute(()->{try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out!=null&&payload!=null)out.write(payload.getBytes(StandardCharsets.UTF_8));}catch(Exception ignored){}});return;}
  if(request==IMPORT_PDF){worker.execute(()->{File f=null;try{
   String id="import-"+System.currentTimeMillis();f=new File(getFilesDir(),id+".pdf");try(InputStream in=getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(f)){byte[] b=new byte[8192];int total=0,n;while((n=in.read(b))!=-1){total+=n;if(total>50*1024*1024)throw new IOException("Imported PDFs must be under 50 MB.");out.write(b,0,n);}}
   int pages;try(ParcelFileDescriptor fd=ParcelFileDescriptor.open(f,ParcelFileDescriptor.MODE_READ_ONLY);PdfRenderer pdf=new PdfRenderer(fd)){pages=pdf.getPageCount();}
   JSONObject item=new JSONObject();item.put("id",id);item.put("title","Imported PDF "+new java.text.SimpleDateFormat("MMM d, HH:mm",Locale.US).format(new java.util.Date()));item.put("pages",pages);
   JSONArray imports=new JSONArray(new Bridge().listImports());imports.put(item);try(OutputStream out=new FileOutputStream(new File(getFilesDir(),"imports.json"))){out.write(imports.toString().getBytes(StandardCharsets.UTF_8));}callback("onPdfImported",item);
  }catch(Exception e){if(f!=null)f.delete();JSONObject error=new JSONObject();try{error.put("error","PDF import failed. Select an unencrypted PDF under 50 MB.");}catch(Exception ignored){}callback("onPdfImported",error);}});}
 }
 @Override public void onBackPressed(){web.evaluateJavascript("window.nativeBack ? window.nativeBack() : false",v->{if(!"true".equals(v))finish();});}
 @Override protected void onDestroy(){worker.shutdownNow();if(web!=null){web.removeJavascriptInterface("Android");web.destroy();}super.onDestroy();}
}
