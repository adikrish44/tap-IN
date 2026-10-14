import java.awt.*;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

/** Self-contained BRICKS launcher icon generator. No copyrighted logos or art. */
public class IconMaker {
    private static final Color BG = new Color(18, 19, 29);
    private static final Color CORAL = new Color(255, 119, 94);
    private static final Color SUN = new Color(255, 212, 109);
    private static final Color MINT = new Color(121, 226, 196);
    private static void rounded(Graphics2D g,Color c,int x,int y,int w,int h,int arc){g.setColor(c);g.fillRoundRect(x,y,w,h,arc,arc);}
    private static void shape(Graphics2D g,int x,int y,int w,int h,Color top,Color bottom){
        g.setPaint(new GradientPaint(x,y,top,x+w,y+h,bottom));g.fillRoundRect(x,y,w,h,54,54);
        g.setColor(new Color(0,0,0,37));g.fillRoundRect(x+16,y+h-25,w-27,25,20,20);
        g.setColor(new Color(255,255,255,55));g.fillRoundRect(x+10,y+9,w-20,12,15,15);
    }
    private static void icon(File folder,String file,int size,boolean round,boolean foreground)throws Exception{
        folder.mkdirs();BufferedImage image=new BufferedImage(size,size,BufferedImage.TYPE_INT_ARGB);
        Graphics2D g=image.createGraphics();g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING,RenderingHints.VALUE_RENDER_QUALITY);g.scale(size/1024.0,size/1024.0);
        if(!foreground){g.setColor(BG);if(round)g.fillOval(0,0,1024,1024);else g.fillRoundRect(0,0,1024,1024,230,230);} else rounded(g,BG,55,55,914,914,310);
        g.setPaint(new RadialGradientPaint(510,420,470,new float[]{0,1},new Color[]{new Color(255,119,94,80),new Color(0,0,0,0)}));g.fillOval(45,55,940,860);
        // Handmade interlocking 2x2 brick viewed from the front.
        shape(g,172,325,680,370,new Color(255,158,131),new Color(238,83,67));
        for(int i=0;i<3;i++){
          int x=250+i*204;
          g.setColor(new Color(189,69,55));g.fillRoundRect(x,274,124,79,36,36);
          g.setPaint(new GradientPaint(x,258,new Color(255,186,157),x,330,new Color(255,137,110)));
          g.fillRoundRect(x+4,260,116,77,35,35);
          g.setColor(new Color(255,255,255,80));g.fillRoundRect(x+20,273,80,11,10,10);
        }
        g.setColor(new Color(255,243,220));g.setStroke(new BasicStroke(68,BasicStroke.CAP_ROUND,BasicStroke.JOIN_ROUND));
        g.drawLine(468,423,374,626);g.drawLine(646,423,553,626);
        // tiny yellow click-in accent
        rounded(g,SUN,655,651,105,36,15);
        g.dispose();ImageIO.write(image,"png",new File(folder,file));
    }
    public static void main(String[] args)throws Exception{
      File res=new File(args[0]);int[] sizes={48,72,96,144,192};String[] density={"mdpi","hdpi","xhdpi","xxhdpi","xxxhdpi"};
      for(int i=0;i<sizes.length;i++){File d=new File(res,"mipmap-"+density[i]);icon(d,"ic_launcher.png",sizes[i],false,false);icon(d,"ic_launcher_round.png",sizes[i],true,false);icon(d,"ic_launcher_foreground.png",Math.round(sizes[i]*2.25f),false,true);}
      System.out.println("Created BRICKS 3D launcher icon at all Android densities");
    }
}