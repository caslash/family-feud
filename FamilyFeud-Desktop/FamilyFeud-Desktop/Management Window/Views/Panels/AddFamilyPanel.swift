//
//  AddFamilyPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/1/23.
//

import SwiftUI

struct AddFamilyPanel: View {
    @State public var familyName: String = ""
    var body: some View {
        PanelView("Add New Family") {
            VStack {
                TextField("Family Name", text: self.$familyName)
                    .multilineTextAlignment(.center)
                    .frame(width: 300)
                
                HStack {
                    Button("Add") { }
                    
                    Button("Remove") { }
                }
            }
        }
        .frame(width: 400, height: 200, alignment: .center)
        .background(.thickMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(radius: 2, x: 0, y: 2)
    }
}

#Preview {
    AddFamilyPanel()
}
