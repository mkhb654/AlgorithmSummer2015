import com.sun.org.apache.bcel.internal.generic.FieldGenOrMethodGen;
import javafx.scene.effect.Bloom;

/**
 * Created by mkaleem on 5/31/15.
 * Creating an example using Array
 * Then creating an example
 */
public class Array {
    public static void main(String[] args) {

        int [] array = {67,44,344,54,65,66,65,55,443};
        int total = 0;

        for (int counter =0; counter<array.length;counter++ )
            total += array[counter];

        System.out.printf("total of array in element: %d\n", + total);;

    }

}