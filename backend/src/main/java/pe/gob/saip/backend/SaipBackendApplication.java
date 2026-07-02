package pe.gob.saip.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class SaipBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(SaipBackendApplication.class, args);
	}

}
