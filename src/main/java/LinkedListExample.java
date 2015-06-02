import java.util.Arrays;
import java.util.LinkedList;

/**
 * Created by mkaleem on 6/1/15.
 * Use of lInked List
 * nodes
 * insertion
 *
 */
public class LinkedListExample {
    public static void main(String[] args) {
        String []colors = {"black", "Blue" ,"Green"};

        //converting list to arrays
        LinkedList<String> links= new LinkedList<String>(Arrays.asList(colors));

        links.addLast("red");//add as last item
        links.add("pink");
        links.add("green");
        links.addFirst("brown");
        System.out.println(links);

    }

}