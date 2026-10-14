import java.awt.*;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

/** Generates PULSE-branded Android launcher icons using the already-installed JDK. */
public class IconMaker {
    private static final Color BG = new Color(13, 12, 20);
    private static final Color CORAL = new Color(255, 163, 120);
    private static final Color PINK = new Color(252, 72, 114);

    private static void icon(File folder, String file, int size, boolean round, boolean foreground) throws Exception {
        folder.mkdirs();
        BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.scale(size / 1024.0, size / 1024.0);
        if (!foreground) {
            g.setColor(BG);
            if (round) g.fillOval(0, 0, 1024, 1024);
            else g.fillRoundRect(0, 0, 1024, 1024, 205, 205);
        } else {
            g.setColor(BG);
            g.fillRoundRect(50, 50, 924, 924, 350, 350);
        }
        g.setStroke(new BasicStroke(7));
        g.setColor(new Color(255, 150, 130, 60));
        g.drawOval(166, 166, 692, 692);
        g.setColor(new Color(255, 150, 130, 28));
        g.drawOval(220, 220, 584, 584);
        Path2D slash = new Path2D.Double();
        slash.moveTo(558, 172);
        slash.lineTo(737, 172);
        slash.lineTo(435, 852);
        slash.lineTo(258, 852);
        slash.closePath();
        g.setPaint(new GradientPaint(258, 840, PINK, 737, 172, CORAL, false));
        g.fill(slash);
        g.setPaint(new GradientPaint(675, 675, new Color(255, 215, 190), 770, 820, PINK, true));
        g.fillOval(679, 674, 123, 123);
        g.dispose();
        ImageIO.write(image, "png", new File(folder, file));
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("Pass Android res directory");
        File res = new File(args[0]);
        int[] sizes = {48,72,96,144,192};
        String[] density = {"mdpi","hdpi","xhdpi","xxhdpi","xxxhdpi"};
        for (int i = 0; i < sizes.length; i++) {
            File dir = new File(res, "mipmap-" + density[i]);
            icon(dir,"ic_launcher.png",sizes[i],false,false);
            icon(dir,"ic_launcher_round.png",sizes[i],true,false);
            icon(dir,"ic_launcher_foreground.png",(int)(sizes[i] * 2.25),false,true);
        }
        System.out.println("Created chimpanzee PULSE launcher assets");
    }
}