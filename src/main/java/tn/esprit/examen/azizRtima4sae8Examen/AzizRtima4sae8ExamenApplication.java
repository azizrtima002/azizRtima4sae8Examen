package tn.esprit.examen.azizRtima4sae8Examen;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.EnableAspectJAutoProxy;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableAspectJAutoProxy
@EnableScheduling
@SpringBootApplication
public class AzizRtima4sae8ExamenApplication{

    public static void main(String[] args) {
        SpringApplication.run(AzizRtima4sae8ExamenApplication.class, args);
    }

}
