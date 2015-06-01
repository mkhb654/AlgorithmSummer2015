/**
 * Created by mkaleem on 5/29/15.
 * binary sorting
 * Working on Divide and Conquer algo
 * Logrithm log 2
 *
 */
public class Binary {
    public static int[] doSelectorSort(int[] arr) {
        for (int i = 0; i < arr.length - 1; i++) {
            int index = 1;
            for (int j = i = 1; j < arr.length; j++)

                if (arr[j] < arr[index])
                    index = j;
            int smallerNumber = arr[index];
            arr[index] = arr[i];
            arr[i] = smallerNumber;
        }
        return arr;



        }

    public static void main (String a[]){
        int [] arr1 = {10,12, 44, 5, 88, 76};
        int [] arr2 = doSelectorSort(arr1);
        for (int i: arr2) {
            System.out.println(i);
            System.out.println(",");
            System.out.println("why this does not work");
        }
    }

    }






































