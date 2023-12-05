//
//  PlayControlPanel.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/2/23.
//

import SwiftUI

struct PlayControlPanel: View {
    var body: some View {
        PanelView("Play Control") {
            VStack {
                HStack {
                    Button("Select Question") { }
                    
                    Button("Face Off") { }
                    
                    Button("Family Play") { }
                }
                
                HStack {
                    Button("Family Steal") { }
                    
                    Button("Allocate Points") { }
                    
                    Button("Reveal Questions") { }
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
    PlayControlPanel()
}
